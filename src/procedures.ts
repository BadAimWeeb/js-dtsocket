import type { DTSocketServer } from "./server";
import type { DTSocketServer_CSocket } from "./server_csocket";

export type EventTableBase = {
    csEvents: {
        [event: string]: (...args: any[]) => void
    },
    scEvents: {
        [event: string]: (...args: any[]) => void
    }
};

export const InitProcedureGenerator = <
    GlobalState extends { [key: string]: any } = {},
    LocalState extends { [key: string]: any } = {},
    EventTable extends EventTableBase = {
        csEvents: {},
        scEvents: {}
    }
>() => {
    return {
        input: <TIn>(parser: {
            parse: (input: unknown) => TIn
        }) => {
            return createProcedure<GlobalState, LocalState, TIn, EventTable>(parser.parse);
        }
    }
}

function createProcedure<GlobalState, LocalState, TIn, EventTable extends EventTableBase>(iCallback: (input: unknown) => TIn) {
    return {
        resolve: <TOut>(oCallback: (
            gState: GlobalState, 
            lState: LocalState, 
            input: TIn, 
            socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
            server: DTSocketServer<GlobalState, LocalState, EventTable, any>
        ) => TOut | PromiseLike<TOut>) => {
            return new Procedure<TIn, TOut, EventTable, GlobalState, LocalState>(iCallback, oCallback);
        },
        streamResolve: <TOut>(oCallback: (
            gState: GlobalState, 
            lState: LocalState, 
            input: TIn, 
            socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
            server: DTSocketServer<GlobalState, LocalState, EventTable, any>
        ) => AsyncIterable<TOut>, burst?: boolean) => {
            return new StreamingProcedure<TIn, TOut, EventTable, GlobalState, LocalState>(iCallback, oCallback, burst || false);
        }
    }
}

export class Procedure<TIn, TOut, EventTable extends EventTableBase, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    readonly signature = "procedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (
            gState: GlobalState, 
            lState: LocalState, 
            input: TIn, 
            socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
            server: DTSocketServer<GlobalState, LocalState, EventTable, any>
        ) => TOut | PromiseLike<TOut>
    ) { }

    execute(
        gState: GlobalState, 
        lState: LocalState, 
        input: TIn, 
        socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
        server: DTSocketServer<GlobalState, LocalState, EventTable, any>
    ) {
        return this.oCallback(gState, lState, this.iCallback(input), socket, server);
    }
}

export class StreamingProcedure<TIn, TOut, EventTable extends EventTableBase, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    readonly signature = "streamingProcedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (
            gState: GlobalState, 
            lState: LocalState, 
            input: TIn, 
            socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
            server: DTSocketServer<GlobalState, LocalState, EventTable, any>
        ) => AsyncIterable<TOut>,
        public burst: boolean
    ) { }

    execute(
        gState: GlobalState, 
        lState: LocalState,
        input: TIn, 
        socket: DTSocketServer_CSocket<GlobalState, LocalState, EventTable, any>,
        server: DTSocketServer<GlobalState, LocalState, EventTable, any>
    ) {
        return this.oCallback(gState, lState, this.iCallback(input), socket, server);
    }
}
