import type { TypedEmitter } from "tiny-typed-emitter";
import type { Procedure, StreamingProcedure } from "./procedures.js";

interface SocketEvents<SocketImpl extends Socket = Socket> {
    'data': (QoS: 0 | 1, data: Uint8Array) => void;
    'resumeFailed': (newStream: SocketImpl) => void;

    [k: string]: (...args: any[]) => any;
}

export interface Socket extends TypedEmitter<SocketEvents> {
    connectionPK: string;

    send(qos: 0 | 1, message: Uint8Array): Promise<void>;
}

export type EventType<T extends object> = {
    [K in keyof T]: T[K] extends (...args: infer RT) => void ? RT : never
};

export type CSEventTable<T extends { csEvents: { [event: string]: (...args: any[]) => void } }> = EventType<T["csEvents"]>;
export type SCEventTable<T extends { scEvents: { [event: string]: (...args: any[]) => void } }> = EventType<T["scEvents"]>;

/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolGlobalStateType = "GlobalState";
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolLocalStateType = "LocalState";
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolEventTableType = "EventTable";
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolProceduresType = "Procedures";
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolSocketImplType = "SocketImpl";

export type ServerContext<
    GlobalState extends { [key: string]: any; } = { [key: string]: any },
    LocalState extends { [key: string]: any; } = { [key: string]: any },
    EventTable extends { csEvents: { [event: string]: (...args: any[]) => void }, scEvents: { [event: string]: (...args: any[]) => void } } =
    { csEvents: { [event: string]: (...args: any[]) => void }, scEvents: { [event: string]: (...args: any[]) => void } },
    SocketImpl extends Socket = Socket,
    Procedures extends {
        [api: string]:
        Procedure<any, any, ServerContext<GlobalState, LocalState, EventTable, any, DefaultServerContext[SymbolProceduresType]>> |
        StreamingProcedure<any, any, ServerContext<GlobalState, LocalState, EventTable, any, DefaultServerContext[SymbolProceduresType]>>
    } =
    {
        [api: string]:
        Procedure<any, any, ServerContext<GlobalState, LocalState, EventTable, any, DefaultServerContext[SymbolProceduresType]>> |
        StreamingProcedure<any, any, ServerContext<GlobalState, LocalState, EventTable, any, DefaultServerContext[SymbolProceduresType]>>
    }
> = {
    GlobalState: GlobalState;
    LocalState: LocalState;
    EventTable: EventTable;
    Procedures: Procedures;
    SocketImpl: SocketImpl;
};

export type DefaultServerContext = {
    GlobalState: { [key: string]: any };
    LocalState: { [key: string]: any };
    EventTable: { csEvents: { [event: string]: (...args: any[]) => void }, scEvents: { [event: string]: (...args: any[]) => void } };
    Procedures: {
        [api: string]: Procedure<
            any, any,
            ServerContext<any, any, any, any, any>
        > |
        StreamingProcedure<
            any, any,
            ServerContext<any, any, any, any, any>
        >
    };
    SocketImpl: Socket;
};

export type GetTypeContext<A extends ServerContext<any, any, any, any, any>, SuppliedSymbol extends "GlobalState" | "LocalState" | "EventTable" | "Procedures" | "SocketImpl"> =
    A[SuppliedSymbol] extends undefined ? DefaultServerContext[SuppliedSymbol] : A[SuppliedSymbol];
