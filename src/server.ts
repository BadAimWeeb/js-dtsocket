import type { Procedure, StreamingProcedure } from "./procedures.js";
import type { Socket } from "./types.js";
import { encode, decode } from "msgpack-lite";

export class DTSocketServer<
    GlobalState extends {
        [key: string]: any
    },
    LocalState extends {
        [key: string]: any
    },
    T extends {
        [api: string]: Procedure<any, any, GlobalState> | StreamingProcedure<any, any, GlobalState>
    }
> {
    globalState: GlobalState;
    localState: Map<Socket, Partial<LocalState>> = new Map();

    constructor(private procedures: T, defaultGlobalState?: GlobalState) {
        this.globalState = defaultGlobalState || {} as GlobalState;
    }

    async processSession(socket: Socket) {
        socket.on("data", async (qos, data) => {
            try {
                let decodedData = decode(data) as [mode: number, ...data: unknown[]];
                if (typeof decodedData[0] !== "number") throw new Error("Invalid data");

                switch (decodedData[0]) {
                    case 0: 
                        // Standard procedure
                        if (!qos) return;

                        let m0Data = decodedData.slice(1) as [nonce: number, api: string, input: unknown];
                        if (typeof m0Data[0] !== "number" || typeof m0Data[1] !== "string") throw new Error("Invalid data");

                        let procedure = this.procedures[m0Data[1]];
                        if (!procedure || procedure.signature !== "procedure") {
                            socket.send(1, encode([
                                0, m0Data[0], false, "Procedure not found"
                            ]));
                        }

                        try {
                            if (!this.localState.get(socket)) this.localState.set(socket, {});

                            let result = await procedure.execute(this.globalState, this.localState.get(socket), m0Data[2]);
                            socket.send(1, encode([
                                0, m0Data[0], true, result
                            ]));
                        } catch (e) {
                            socket.send(1, encode([
                                0, m0Data[0], false, e instanceof Error ? e.message : e
                            ]));
                        }
                        break;
                    case 1:
                        // Streaming procedure
                        if (!qos) return;

                        let m1Data = decodedData.slice(1) as [nonce: number, api: string, input: unknown];
                        if (typeof m1Data[0] !== "number" || typeof m1Data[1] !== "string") throw new Error("Invalid data");

                        let streamingProcedure = this.procedures[m1Data[1]];
                        if (
                            !streamingProcedure || 
                            streamingProcedure.signature !== "streamingProcedure"
                        ) {
                            socket.send(1, encode([
                                1, m1Data[0], 2, 0, "Procedure not found"
                            ]));
                            return;
                        }

                        let packetCount = 0;
                        try {
                            if (!this.localState.get(socket)) this.localState.set(socket, {});

                            let stream = streamingProcedure.execute(this.globalState, this.localState.get(socket), m1Data[2]);
                            for await (let packet of stream) {
                                let waitACK = socket.send(1, encode([
                                    1, m1Data[0], 0, packetCount++, packet
                                ]));

                                if (!streamingProcedure.burst) {
                                    await waitACK;
                                }
                            }

                            socket.send(1, encode([
                                1, m1Data[0], 1, packetCount
                            ]));
                        } catch (e) {
                            socket.send(1, encode([
                                1, m1Data[0], 2, packetCount, e instanceof Error ? e.message : e
                            ]));
                        }
                        break;
                }
            } catch (e) {
                console.log(e)
            }
        });
    }
}