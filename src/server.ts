import type { ServerContext, SymbolGlobalStateType, SymbolLocalStateType, SymbolEventTableType, SymbolProceduresType, SymbolSocketImplType, GetTypeContext, DefaultServerContext } from "./types.js";
import { DTSocketServer_CSocket } from "./server_csocket.js";
import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { DTSocketServer_BroadcastOperator } from "./server_broadcast.js";

export interface DTSocketServer<Context extends ServerContext> extends EventEmitter {
    on(event: "session", callback: (cSocket: DTSocketServer_CSocket<Context>) => void): this;
    on<T extends keyof GetTypeContext<Context, SymbolEventTableType>["csEvents"]>(event: T, callback: (...args: Parameters<GetTypeContext<Context, SymbolEventTableType>["csEvents"][T]>) => void): this;
    on(event: string | symbol, callback: (...args: any[]) => void): this;

    originalEmit(event: "session", cSocket: DTSocketServer_CSocket<Context>): boolean;
    originalEmit<T extends keyof GetTypeContext<Context, SymbolEventTableType>["csEvents"]>(event: T, ...args: Parameters<GetTypeContext<Context, SymbolEventTableType>["csEvents"][T]>): boolean;
    originalEmit(event: string | symbol, ...args: any[]): boolean;

    emit<T extends keyof GetTypeContext<Context, SymbolEventTableType>["scEvents"]>(event: T, ...args: Parameters<GetTypeContext<Context, SymbolEventTableType>["scEvents"][T]>): boolean;
    emit(event: string, ...args: any[]): boolean;
}

export class DTSocketServer<Context extends ServerContext = DefaultServerContext> extends EventEmitter {
    globalState: GetTypeContext<Context, SymbolGlobalStateType>;
    localState: Map<string, Partial<GetTypeContext<Context, SymbolLocalStateType>>> = new Map();
    rooms: Map<string, Set<string>> = new Map();
    cSockets: Map<string, DTSocketServer_CSocket<Context>> = new Map();

    constructor(public procedures: GetTypeContext<Context, SymbolProceduresType>, defaultGlobalState?: GetTypeContext<Context, SymbolGlobalStateType>) {
        super();
        this.originalEmit = this.emit.bind(this);
        this.emit = (event: string | symbol, ...args: any[]) => {
            // Broadcast to all sockets
            for (const cSocket of this.cSockets.values()) {
                cSocket.emit(event, ...args);
            }

            return true;
        }
        this.globalState = defaultGlobalState || {} as GetTypeContext<Context, SymbolGlobalStateType>;
    }

    async processSession<T extends GetTypeContext<Context, SymbolSocketImplType>>(socket: T): Promise<DTSocketServer_CSocket<Context, T>> {
        const socketID = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        const cSocket = new DTSocketServer_CSocket(socketID, socket, this);

        this.originalEmit("session", cSocket);
        this.cSockets.set(socketID, cSocket);

        return cSocket;
    }

    async removeSession(socket: GetTypeContext<Context, SymbolSocketImplType>) {
        const socketID = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        this.cSockets.delete(socketID);

        for (let rooms of this.rooms.values()) {
            rooms.delete(socketID);
        }
    }

    to(room: string | string[]) {
        return new DTSocketServer_BroadcastOperator(this, ([] as string[]).concat(room));
    }
}