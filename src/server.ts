import type { Procedure, StreamingProcedure } from "./procedures.js";
import type { Socket } from "./types.js";
import { DTSocketServer_CSocket } from "./server_csocket.js";
import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { DTSocketServer_BroadcastOperator } from "./server_broadcast.js";

export interface DTSocketServer<
    GlobalState extends {
        [key: string]: any
    },
    LocalState extends {
        [key: string]: any
    },
    EventTable extends {
        csEvents: {
            [event: string]: (...args: any[]) => void
        },
        scEvents: {
            [event: string]: (...args: any[]) => void
        }
    },
    T extends {
        [api: string]: Procedure<any, any, EventTable, GlobalState, LocalState> | StreamingProcedure<any, any, EventTable, GlobalState, LocalState>
    }
> extends EventEmitter {
    on(event: "session", callback: (cSocket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>) => void): this;
    on(event: string | symbol, callback: (...args: any[]) => void): this;

    originalEmit(event: "session", cSocket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>): boolean;
    originalEmit(event: string | symbol, ...args: any[]): boolean;

    emit<T extends keyof EventTable["scEvents"]>(event: T, ...args: Parameters<EventTable["scEvents"][T]>): boolean;
    emit(event: string, ...args: any[]): boolean;
}

export class DTSocketServer<
    GlobalState extends {
        [key: string]: any
    },
    LocalState extends {
        [key: string]: any
    },
    EventTable extends {
        csEvents: {
            [event: string]: (...args: any[]) => void
        },
        scEvents: {
            [event: string]: (...args: any[]) => void
        }
    },
    T extends {
        [api: string]: Procedure<any, any, EventTable, GlobalState, LocalState> | StreamingProcedure<any, any, EventTable, GlobalState, LocalState>
    } = {}
> extends EventEmitter {
    globalState: GlobalState;
    localState: Map<string, Partial<LocalState>> = new Map();
    rooms: Map<string, Set<string>> = new Map();
    cSockets: Map<string, DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>> = new Map();

    constructor(public procedures: T, defaultGlobalState?: GlobalState) {
        super();
        this.originalEmit = this.emit.bind(this);
        this.emit = (event: string | symbol, ...args: any[]) => {
            // Broadcast to all sockets
            for (const cSocket of this.cSockets.values()) {
                cSocket.emit(event, ...args);
            }

            return true;
        }
        this.globalState = defaultGlobalState || {} as GlobalState;
    }

    async processSession(socket: Socket) {
        const socketID = Buffer.from(new Uint8Array(await crypto.subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        const cSocket = new DTSocketServer_CSocket(socketID, socket, this);

        this.originalEmit("session", cSocket);
        this.cSockets.set(socketID, cSocket);
    }

    to(room: string | string[]) {
        return new DTSocketServer_BroadcastOperator(this, [...room]);
    }
}