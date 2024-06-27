import { EventEmitter } from "events";
import type { GetTypeContext, KeyOfStringOnly, ServerContext, Socket, SymbolEventTableType, SymbolLocalStateType, SymbolSocketImplType } from "./types";
import type { DTSocketServerInterface } from "./server.js";

import { encode, decode } from "msgpack-lite";
import { DTSSBOImpl, DTSocketServer_BroadcastOperator } from "./server_broadcast.js";



type MapEmitTable<Context extends ServerContext> = {
    cs: {
        [K in keyof GetTypeContext<Context, SymbolEventTableType>["csEvents"]]: Parameters<GetTypeContext<Context, SymbolEventTableType>["csEvents"][K]>
    } & {
        "internal:drop": []
    },
    sc: {
        [K in keyof GetTypeContext<Context, SymbolEventTableType>["scEvents"]]: Parameters<GetTypeContext<Context, SymbolEventTableType>["scEvents"][K]>
    }
}

export interface DTSocketServer_CSocket<
    Context extends ServerContext, 
    /** PRIVATE TYPE VARIABLE, DO NOT OVERRIDE */
    EmitTable extends MapEmitTable<Context> = MapEmitTable<Context>
> {
    addListener<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this
    on<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this
    once<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this
    prependListener<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this
    prependOnceListener<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this

    off<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this
    removeAllListeners<E extends KeyOfStringOnly<EmitTable["cs"]>>(event?: E): this
    removeListener<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E, listener: (...args: EmitTable["cs"][E]) => void): this

    emit<E extends KeyOfStringOnly<EmitTable["sc"]>>(event: E, ...args: EmitTable["sc"][E]): boolean
    eventNames(): string[]
    rawListeners<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E): ((...args: EmitTable["cs"][E]) => void)[]
    listeners<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E): ((...args: EmitTable["cs"][E]) => void)[]
    listenerCount<E extends KeyOfStringOnly<EmitTable["cs"]>>(event: E): number

    getMaxListeners(): number
    setMaxListeners(maxListeners: number): this

    lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>
    join(room: string): void
    leave(room: string): void
    leaveAll(): void
    rooms: Set<string>
    to(room: string | string[]): DTSocketServer_BroadcastOperator<Context>

    id: string
    server: DTSocketServerInterface<Context>
    socket: GetTypeContext<Context, SymbolSocketImplType>
}

export class DTSSCSImpl extends EventEmitter {
    private m2Table: {
        [event: string]: Map<number, unknown[]>
    } = {};
    private m2RecvCounter: Map<string | number, number> = new Map();
    private m2SendCounter: Map<string | number, number> = new Map();

    get lState() {
        return this.server.localState.get(this.id) || {};
    }

    constructor(public id: string, public socket: Socket, public server: DTSocketServerInterface<any>, serverOriginalEmit: (event: string, ...args: any[]) => boolean) {
        super();
        let originalEmit = this.emit.bind(this);
        this.emit = (event: string, ...args: any[]) => {
            if (!this.m2SendCounter.has(event)) this.m2SendCounter.set(event, 0);
            socket.send(1, encode([
                2, event, this.m2SendCounter.get(event), ...args
            ]));
            this.m2SendCounter.set(event, this.m2SendCounter.get(event)! + 1);

            return true;
        }

        this.join(id);

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

                        let procedure = server.procedures[m0Data[1]];
                        if (!procedure || procedure.signature !== "procedure") {
                            socket.send(1, encode([
                                0, m0Data[0], false, "Procedure not found"
                            ]));
                        }

                        try {
                            if (!server.localState.get(id)) server.localState.set(id, {});

                            let result = await procedure.execute(server.globalState, server.localState.get(id)!, m0Data[2], this);
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

                        let streamingProcedure = server.procedures[m1Data[1]];
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
                            if (!server.localState.get(id)) server.localState.set(id, {});

                            let stream = streamingProcedure.execute(server.globalState, server.localState.get(id)!, m1Data[2], this);
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
                    case 2:
                        // Ordered event transmission
                        if (!qos) return;

                        let m2Data = decodedData.slice(1) as [event: string, nonce: number, ...args: unknown[]];
                        if (!this.m2RecvCounter.has(m2Data[0])) this.m2RecvCounter.set(m2Data[0], 0);
                        if (typeof m2Data[1] !== "number") throw new Error("Invalid data");
                        if (!this.m2Table[m2Data[0]]) this.m2Table[m2Data[0]] = new Map();

                        this.m2Table[m2Data[0]].set(m2Data[1], m2Data.slice(2));
                        if (m2Data[1] === this.m2RecvCounter.get(m2Data[0])) {
                            for (; ;) {
                                let data = this.m2Table[m2Data[0]].get(this.m2RecvCounter.get(m2Data[0])!);
                                if (!data) break;

                                this.m2Table[m2Data[0]].delete(this.m2RecvCounter.get(m2Data[0])!);
                                this.m2RecvCounter.set(m2Data[0], this.m2RecvCounter.get(m2Data[0])! + 1);

                                originalEmit(m2Data[0], ...data);
                                if (m2Data[0] !== "session") serverOriginalEmit(m2Data[0], ...data);
                            }
                        }
                        break;
                }
            } catch (e) {
                console.log(e)
            }
        });
    }

    join(room: string) {
        if (!this.server.rooms.has(room)) this.server.rooms.set(room, new Set());
        this.server.rooms.get(room)!.add(this.id);
    }

    leave(room: string) {
        if (!this.server.rooms.has(room)) return;
        this.server.rooms.get(room)!.delete(this.id);
    }

    leaveAll() {
        for (let room of this.server.rooms.keys()) {
            this.leave(room);
        }
    }

    get rooms() {
        let rooms = new Set<string>();
        for (let [room, clients] of this.server.rooms) {
            if (clients.has(this.id)) rooms.add(room);
        }

        return rooms;
    }

    to(room: string | string[]) {
        return new DTSSBOImpl(this.server, ([] as string[]).concat(room), [this.id]);
    }
}
