import { encode, decode } from "msgpack-lite";
import type { DTSocketServer } from "./server.js";
import type { Socket } from "./types.js";

type P<T extends DTSocketServer<any, any, any>> = T extends DTSocketServer<any, any, infer P> ? P : never;

export class DTSocketClient<T extends DTSocketServer<any, any, any>> {
    m0CallbackTable: Map<number, [resolve: (value: unknown) => void, reject: (reason?: any) => void]> = new Map(); // nonce, callback

    procedure = <APIKey extends keyof P<T>>(x: APIKey) => {
        return (input: Parameters<P<T>[APIKey]["execute"]>[2]) => {
            return new Promise<ReturnType<P<T>[APIKey]["execute"]>>((resolve, reject) => {
                let nonce = Math.random();
                this.m0CallbackTable.set(nonce, [resolve, reject]);
                this.socket.send(1, encode(input === undefined ? [
                    0, nonce, x
                ] : [
                    0, nonce, x, input
                ]));
            });
        }
    }

    constructor(private socket: Socket) {
        this.socket.on("data", async (qos, data) => {
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
                }
            } catch (e) {
                console.error(e);
            }
        });    
    }
}
