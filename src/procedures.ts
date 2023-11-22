import type { DTSocketServer_CSocket } from "./server_csocket";
import type { ServerContext, GetTypeContext, SymbolGlobalStateType, SymbolLocalStateType, Socket } from "./types";

export type EventTableBase = {
    csEvents: {
        [event: string]: (...args: any[]) => void
    },
    scEvents: {
        [event: string]: (...args: any[]) => void
    }
};

export const InitProcedureGenerator: <Context extends ServerContext>() => {
    input: <TIn>(parser: {
        parse: (input: unknown) => TIn
    }) => ReturnType<typeof createProcedure<TIn, Context>>
} = <Context extends ServerContext>() => {
    return {
        input: <TIn>(parser: {
            parse: (input: unknown) => TIn
        }) => {
            return createProcedure<TIn, Context>(parser.parse);
        }
    }
}

function createProcedure<TIn, Context extends ServerContext>(iCallback: (input: unknown) => TIn): ({
    resolve: <TOut>(oCallback: (
        gState: GetTypeContext<Context, SymbolGlobalStateType>, 
        lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>, 
        input: TIn, 
        socket: DTSocketServer_CSocket<Context>
    ) => TOut | PromiseLike<TOut>) => Procedure<TIn, TOut, Context>,
    streamResolve: <TOut>(oCallback: (
        gState: GetTypeContext<Context, SymbolGlobalStateType>, 
        lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>, 
        input: TIn, 
        socket: DTSocketServer_CSocket<Context>
    ) => AsyncIterable<TOut>, burst?: boolean) => StreamingProcedure<TIn, TOut, Context>
}) {
    return {
        resolve: (oCallback) => {
            return new Procedure(iCallback, oCallback);
        },
        streamResolve: (oCallback, burst?: boolean) => {
            return new StreamingProcedure(iCallback, oCallback, burst || false);
        }
    }
}

export class Procedure<TIn, TOut, Context extends ServerContext> {
    readonly signature = "procedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (
            gState: GetTypeContext<Context, SymbolGlobalStateType>, 
            lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>, 
            input: TIn, 
            socket: DTSocketServer_CSocket<Context, Socket>
        ) => TOut | PromiseLike<TOut>
    ) { }

    execute(
        gState: GetTypeContext<Context, SymbolGlobalStateType>, 
        lState: Partial<Partial<GetTypeContext<Context, SymbolLocalStateType>>>, 
        input: TIn, 
        socket: DTSocketServer_CSocket<Context, Socket>
    ) {
        return this.oCallback(gState, lState, this.iCallback(input), socket);
    }
}

export class StreamingProcedure<TIn, TOut, Context extends ServerContext> {
    readonly signature = "streamingProcedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (
            gState: GetTypeContext<Context, SymbolGlobalStateType>, 
            lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>, 
            input: TIn, 
            socket: DTSocketServer_CSocket<Context, Socket>
        ) => AsyncIterable<TOut>,
        public burst: boolean
    ) { }

    execute(
        gState: GetTypeContext<Context, SymbolGlobalStateType>, 
        lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>,
        input: TIn, 
        socket: DTSocketServer_CSocket<Context, Socket>
    ) {
        return this.oCallback(gState, lState, this.iCallback(input), socket);
    }
}
