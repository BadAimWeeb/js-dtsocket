import { encode, decode } from "msgpack-lite";
import type { DTSocketServer } from "./server.js";
import type { Socket } from "./types.js";
import type { Procedure, StreamingProcedure } from "./procedures.js";
import { EventEmitter } from "events";

type P<T extends DTSocketServer<any, any, any>> = T extends DTSocketServer<any, any, infer P> ? P : never;
type AsyncIterableUnwrap<T> = T extends AsyncIterable<infer U> ? U : never;

type StandandProcedureArray<T extends object> = {
    [K in keyof T]: T[K] extends Procedure<any, any, any, any> ? K : never
}[keyof T];

type StreamingProcedureArray<T extends object> = {
    [K in keyof T]: T[K] extends StreamingProcedure<any, any, any, any> ? K : never
}[keyof T];

export class DTSocketClient<T extends DTSocketServer<any, any, any>> {
    nonceCounter = 0;
    m0CallbackTable: Map<
        number /** nonce */,
        [resolve: (value: unknown) => void, reject: (reason?: any) => void] /** callback */
    > = new Map();

    m1CallbackTable: Map<
        number /** nonce */,
        [stream: (packetNo: number, value: unknown) => void, end: (totalPacket: number) => void, fault: (totalPacket: number, reason?: any) => void] /** callback */
    > = new Map();

    procedure = <APIKey extends StandandProcedureArray<P<T>>>(x: APIKey) => {
        return (input: Parameters<P<T>[APIKey]["execute"]>[2]) => {
            return new Promise((resolve, reject) => {
                let nonce = this.nonceCounter++;
                this.m0CallbackTable.set(nonce, [resolve, reject]);
                this.socket.send(1, encode(input === undefined ? [
                    0, nonce, x
                ] : [
                    0, nonce, x, input
                ]));
            }) as Promise<Awaited<ReturnType<P<T>[APIKey]["execute"]>>>;
        }
    }

    streamingProcedure = <APIKey extends StreamingProcedureArray<P<T>>>(x: APIKey) => {
        return (input: Parameters<P<T>[APIKey]["execute"]>[2]) => {
            let that = this;
            return (async function* () {
                type StreamReturnType = AsyncIterableUnwrap<ReturnType<P<T>[APIKey]["execute"]>>;

                let nonce = that.nonceCounter++;
                let packetNo = 0;
                let endPacketNo = -1;
                let packetList: Map<number, StreamReturnType> = new Map();
                let eventChannel = new EventEmitter();
                let pendingEnd = false;
                let pendingThrow = false;
                let pendingThrowReason: any;

                that.m1CallbackTable.set(nonce, [
                    async (remotePacketNo, value: StreamReturnType) => {
                        packetList.set(packetNo, value);
                        if (packetNo === remotePacketNo) {
                            for (; ;) {
                                if (!packetList.has(packetNo)) break;
                                let packet = packetList.get(packetNo);

                                let rec = eventChannel.emit("data", packet);
                                if (rec) {
                                    packetList.delete(packetNo);
                                    packetNo++;
                                } else {
                                    await new Promise<void>((resolve) => {
                                        eventChannel.once("ready", () => {
                                            resolve();
                                        });
                                        setTimeout(resolve, 50);
                                    });
                                }
                            }

                            if (endPacketNo >= packetNo) {
                                if (pendingEnd) eventChannel.emit("end");
                                if (pendingThrow) eventChannel.emit("fault", pendingThrowReason);
                            }
                        }
                    },
                    (totalPacket) => {
                        if (totalPacket === packetNo) {
                            let first = eventChannel.emit("end");
                            if (!first) {
                                eventChannel.once("ready", () => {
                                    eventChannel.emit("end");
                                });
                            }
                        } else {
                            endPacketNo = totalPacket;
                            pendingEnd = true;
                        }
                    },
                    (totalPacket, reason) => {
                        if (totalPacket === packetNo) {
                            let first = eventChannel.emit("fault", reason);
                            if (!first) {
                                eventChannel.once("ready", () => {
                                    eventChannel.emit("fault", reason);
                                });
                            }
                        } else {
                            endPacketNo = totalPacket;
                            pendingThrow = true;
                            pendingThrowReason = reason;
                        }
                    }
                ]);

                that.socket.send(1, encode(input === undefined ? [
                    1, nonce, x
                ] : [
                    1, nonce, x, input
                ]));

                for (; ;) {
                    try {
                        yield await new Promise<StreamReturnType>((resolve, reject) => {
                            eventChannel.once("data", (value: StreamReturnType) => {
                                resolve(value);
                            });

                            eventChannel.once("end", () => {
                                reject(["end"]);
                            });

                            eventChannel.once("fault", (reason: any) => {
                                reject(["fault", reason]);
                            });

                            eventChannel.emit("ready");
                        });
                    } catch (e) {
                        if (Array.isArray(e)) {
                            if (e[0] === "end") {
                                break;
                            } else if (e[0] === "fault") {
                                throw e[1];
                            }
                        }
                    }
                }
            })();
        }
    }

    async _handleData(qos: number, data: Uint8Array) {
        try {
            let decodedData = decode(data) as [mode: number, ...data: unknown[]];
            if (typeof decodedData[0] !== "number") throw new Error("Invalid data");

            switch (decodedData[0]) {
                case 0:
                    if (!qos) return;

                    let m0Data = decodedData.slice(1) as [nonce: number, success: boolean, result: unknown];
                    if (typeof m0Data[0] !== "number" || typeof m0Data[1] !== "boolean") throw new Error("Invalid data");

                    let callback = this.m0CallbackTable.get(m0Data[0]);
                    if (!callback) return;

                    this.m0CallbackTable.delete(m0Data[0]);
                    if (m0Data[1]) {
                        callback[0](m0Data[2]);
                    } else {
                        callback[1](m0Data[2]);
                    }
                    break;
                case 1:
                    if (!qos) return;

                    let m1Data = decodedData.slice(1) as [nonce: number, type: number, packetNo: number, result: unknown];
                    if (typeof m1Data[0] !== "number" || typeof m1Data[1] !== "number" || typeof m1Data[2] !== "number") throw new Error("Invalid data");

                    let callback2 = this.m1CallbackTable.get(m1Data[0]);
                    if (!callback2) return;

                    switch (m1Data[1]) {
                        case 0:
                            // Data
                            callback2[0](m1Data[2], m1Data[3]);
                            break;
                        case 1:
                            // End
                            callback2[1](m1Data[2]);
                            this.m1CallbackTable.delete(m1Data[0]);
                            break;
                        case 2:
                            // Fault
                            callback2[2](m1Data[2], m1Data[3]);
                            this.m1CallbackTable.delete(m1Data[0]);
                            break;
                    }
                    break;
            }
        } catch (e) {
            console.error(e);
        }
    }

    constructor(private socket: Socket) {
        let u = this._handleData.bind(this);
        this.socket.on("data", u);

        this.socket.on("resumeFailed", newSocket => {
            // throw all pending promises
            for (let [nonce, callback] of this.m0CallbackTable) {
                callback[1]("Old connection closed");
            }

            for (let [nonce, callback] of this.m1CallbackTable) {
                callback[2](0, "Old connection closed");
            }

            this.m0CallbackTable.clear();
            this.m1CallbackTable.clear();

            this.socket.removeListener("data", u);
            this.socket = newSocket;
            this.socket.on("data", u);
        });
    }
}
