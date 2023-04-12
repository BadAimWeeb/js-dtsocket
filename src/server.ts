import type { Procedure, StreamingProcedure } from "./procedures.js";
import type { Socket } from "./types.js";
import { DTSocketServer_CSocket } from "./server_csocket.js";
import { EventEmitter } from "events";
import { subtle } from "crypto";
import { Buffer } from "buffer";

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
        [api: string]: Procedure<any, any, GlobalState, LocalState> | StreamingProcedure<any, any, GlobalState, LocalState>
    }
> extends EventEmitter {
    on(event: "session", callback: (cSocket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>) => void): this;
    on(event: string | symbol, callback: (...args: any[]) => void): this;

    emit(event: "session", cSocket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>): boolean;
    emit(event: string | symbol, ...args: any[]): boolean;
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
        [api: string]: Procedure<any, any, GlobalState, LocalState> | StreamingProcedure<any, any, GlobalState, LocalState>
    } = {}
> extends EventEmitter {
    globalState: GlobalState;
    localState: Map<string, Partial<LocalState>> = new Map();
    rooms: Map<string, Set<string>> = new Map();
    cSockets: Map<string, DTSocketServer_CSocket<GlobalState, LocalState, EventTable, T>> = new Map();

    constructor(public procedures: T, defaultGlobalState?: GlobalState) {
        super();
        this.globalState = defaultGlobalState || {} as GlobalState;
    }

    async processSession(socket: Socket) {
        const socketID = Buffer.from(new Uint8Array(await subtle.digest("SHA-512", Buffer.from(socket.connectionPK)))).toString("hex");
        const cSocket = new DTSocketServer_CSocket(socketID, socket, this);

        this.emit("session", cSocket);
        this.cSockets.set(socketID, cSocket);
    }
}