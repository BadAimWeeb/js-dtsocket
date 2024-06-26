import type { ServerContext, SymbolGlobalStateType, SymbolLocalStateType, SymbolEventTableType, SymbolProceduresType, SymbolSocketImplType, GetTypeContext, DefaultServerContext, Socket, KeyOfStringOnly } from "./types.js";
import { DTSocketServer_CSocket, DTSSCSImpl } from "./server_csocket.js";
import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { DTSocketServer_BroadcastOperator, DTSSBOImpl } from "./server_broadcast.js";

type MapEmitTable<Context extends ServerContext> = {
    cs: {
        [K in keyof GetTypeContext<Context, SymbolEventTableType>["csEvents"]]: Parameters<GetTypeContext<Context, SymbolEventTableType>["csEvents"][K]>
    } & {
        "internal:new-session": [DTSocketServer_CSocket<Context>],
        "internal:remove-session": [DTSocketServer_CSocket<Context>]
    },
    sc: {
        [K in keyof GetTypeContext<Context, SymbolEventTableType>["scEvents"]]: Parameters<GetTypeContext<Context, SymbolEventTableType>["scEvents"][K]>
    }
}

export interface DTSocketServerInterface<
    Context extends ServerContext = DefaultServerContext,
    /** PRIVATE TYPE VARIABLE, DO NOT OVERRIDE */
    EmitTable extends MapEmitTable<Context> = MapEmitTable<Context>
> {
    globalState: GetTypeContext<Context, SymbolGlobalStateType>;
    localState: Map<string, Partial<GetTypeContext<Context, SymbolLocalStateType>>>;
    rooms: Map<string, Set<string>>;
    cSockets: Map<string, DTSocketServer_CSocket<Context>>;
    procedures: GetTypeContext<Context, SymbolProceduresType>;

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

    processSession<T extends GetTypeContext<Context, SymbolSocketImplType>>(socket: T): Promise<DTSocketServer_CSocket<Context>>
    removeSession(socket: GetTypeContext<Context, SymbolSocketImplType>): Promise<void>

    to(room: string | string[]): DTSocketServer_BroadcastOperator<Context>
};

const DTSSImpl = class DTSocketServer extends EventEmitter {
    globalState: any;
    localState: Map<string, any> = new Map();
    rooms: Map<string, Set<string>> = new Map();
    cSockets: Map<string, DTSocketServer_CSocket<any>> = new Map();

    private _originalEmit = this.emit.bind(this);

    constructor(public procedures: any, defaultGlobalState?: any) {
        super();
        this.emit = (event: string, ...args: any[]) => {
            // Broadcast to all sockets
            for (const cSocket of this.cSockets.values()) {
                cSocket.emit(event, ...args);
            }

            return true;
        }
        this.globalState = defaultGlobalState || {};
    }

    async processSession(socket: Socket): Promise<DTSocketServer_CSocket<any, any>> {
        const socketID = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        // @ts-ignore
        const cSocket = new DTSSCSImpl(socketID, socket, this, this._originalEmit) as any as DTSocketServer_CSocket<any>;

        this._originalEmit("internal:new-session", cSocket);
        this.cSockets.set(socketID, cSocket);

        return cSocket;
    }

    async removeSession(socket: Socket) {
        const socketID = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        const cSocket = this.cSockets.get(socketID);

        if (cSocket) {
            this._originalEmit("internal:remove-session", cSocket);
        }

        this.cSockets.delete(socketID);

        for (let rooms of this.rooms.values()) {
            rooms.delete(socketID);
        }
    }

    to(room: string | string[]): DTSocketServer_BroadcastOperator<any> {
        // @ts-ignore
        return new DTSSBOImpl(this, ([] as string[]).concat(room));
    }
}

export const DTSocketServer = DTSSImpl as any as new <Context extends ServerContext = DefaultServerContext>(procedures: GetTypeContext<Context, SymbolProceduresType>, defaultGlobalState?: GetTypeContext<Context, SymbolGlobalStateType>) => DTSocketServerInterface<Context>;