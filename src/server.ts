import type { Procedure } from "./procedures.js";
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
        [api: string]: Procedure<any, any>
    }
> {
    globalState: GlobalState;
    localState: Map<Socket, Partial<LocalState>> = new Map();
    private handler: T;

    constructor(handler: T, defaultGlobalState?: GlobalState) {
        this.handler = handler;
        this.globalState = defaultGlobalState || {} as GlobalState;
    }

    async processSession(socket: Socket) {
        socket.on("data", async (qos, data) => {
            try {
                let decodedData = decode(data) as [mode: number, ...data: unknown[]];
                if (typeof decodedData[0] !== "number") throw new Error("Invalid data");

                switch (decodedData[0]) {
                    case 0: 
                        if (!qos) return;

                        let m0Data = decodedData.slice(1) as [nonce: number, api: string, input: unknown];
                        if (typeof m0Data[0] !== "number" || typeof m0Data[1] !== "string") throw new Error("Invalid data");

                        let procedure = this.handler[m0Data[1]];
                        if (!procedure) {
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
                                0, m0Data[0], false, e instanceof Error ? e.message : String(e)
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