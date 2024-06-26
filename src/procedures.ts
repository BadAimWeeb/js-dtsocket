import type { DTSocketServer_CSocket } from "./server_csocket";
import type { ServerContext, GetTypeContext, SymbolGlobalStateType, SymbolLocalStateType } from "./types";

export type EventTableBase = {
    csEvents: {
        [event: string]: (...args: any[]) => void
    },
    scEvents: {
        [event: string]: (...args: any[]) => void
    }
};

export const InitProcedureGenerator: <Context extends ServerContext>() => {
    // Bulk of typing is done here
    input: <TIn>(parser: {
        parse: (input: unknown) => TIn
    }) => {
        resolve: <TOut>(
            oCallback: (
                gState: GetTypeContext<Context, SymbolGlobalStateType>,
                lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>,
                input: TIn,
                socket: DTSocketServer_CSocket<Context>
            ) => TOut | PromiseLike<TOut>
        ) => Procedure<TIn, TOut, Context>,

        streamResolve: <TOut>(
            oCallback: (
                gState: GetTypeContext<Context, SymbolGlobalStateType>,
                lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>,
                input: TIn,
                socket: DTSocketServer_CSocket<Context>
            ) => AsyncIterable<TOut>,
            burst?: boolean
        ) => StreamingProcedure<TIn, TOut, Context>
    }
} = () => {
    return {
        input: (parser: any) => createProcedure(parser.parse)
    } as any;
}

const createProcedure = (iCallback: (input: unknown) => any) => {
    return {
        resolve: (oCallback: any) => {
            return new Procedure(iCallback, oCallback);
        },
        streamResolve: (oCallback: any, burst?: boolean) => {
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
            socket: DTSocketServer_CSocket<Context>
        ) => TOut | PromiseLike<TOut>
    ) { }

    execute(
        gState: GetTypeContext<Context, SymbolGlobalStateType>,
        lState: Partial<Partial<GetTypeContext<Context, SymbolLocalStateType>>>,
        input: TIn,
        socket: DTSocketServer_CSocket<Context>
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
            socket: DTSocketServer_CSocket<Context>
        ) => AsyncIterable<TOut>,
        public burst: boolean
    ) { }

    execute(
        gState: GetTypeContext<Context, SymbolGlobalStateType>,
        lState: Partial<GetTypeContext<Context, SymbolLocalStateType>>,
        input: TIn,
        socket: DTSocketServer_CSocket<Context>
    ) {
        return this.oCallback(gState, lState, this.iCallback(input), socket);
    }
}
