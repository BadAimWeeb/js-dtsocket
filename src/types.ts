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

const SymbolGlobalState: unique symbol = Symbol();
const SymbolLocalState: unique symbol = Symbol();
const SymbolEventTable: unique symbol = Symbol();
const SymbolProcedures: unique symbol = Symbol();
const SymbolSocketImpl: unique symbol = Symbol();

/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolGlobalStateType = typeof SymbolGlobalState;
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolLocalStateType = typeof SymbolLocalState;
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolEventTableType = typeof SymbolEventTable;
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolProceduresType = typeof SymbolProcedures;
/** WARNING: ONLY USE THIS ON TYPES. */
export type SymbolSocketImplType = typeof SymbolSocketImpl;

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
    [SymbolGlobalState]: GlobalState;
    [SymbolLocalState]: LocalState;
    [SymbolEventTable]: EventTable;
    [SymbolProcedures]: Procedures;
    [SymbolSocketImpl]: SocketImpl;
};

export type DefaultServerContext = {
    [SymbolGlobalState]: { [key: string]: any };
    [SymbolLocalState]: { [key: string]: any };
    [SymbolEventTable]: { csEvents: { [event: string]: (...args: any[]) => void }, scEvents: { [event: string]: (...args: any[]) => void } };
    [SymbolProcedures]: {
        [api: string]: Procedure<
            any, any,
            ServerContext<any, any, any, any, any>
        > |
        StreamingProcedure<
            any, any,
            ServerContext<any, any, any, any, any>
        >
    };
    [SymbolSocketImpl]: Socket;
};

export type GetTypeContext<A extends ServerContext<any, any, any, any, any>, SuppliedSymbol extends SymbolGlobalStateType | SymbolLocalStateType | SymbolProceduresType | SymbolSocketImplType | SymbolEventTableType> =
    A[SuppliedSymbol] extends undefined ? DefaultServerContext[SuppliedSymbol] : A[SuppliedSymbol];
