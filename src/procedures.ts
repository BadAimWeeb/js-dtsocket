export const InitProcedureGenerator = <
    GlobalState extends { [key: string]: any } = {},
    LocalState extends { [key: string]: any } = {}
>() => {
    return {
        input: <TIn>(parser: {
            parse: (input: unknown) => TIn
        }) => {
            return createProcedure<GlobalState, LocalState, TIn>(parser.parse);
        }
    }
}

function createProcedure<GlobalState, LocalState, TIn>(iCallback: (input: unknown) => TIn) {
    return {
        resolve: <TOut>(oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => TOut | PromiseLike<TOut>) => {
            return new Procedure<TIn, TOut, GlobalState, LocalState>(iCallback, oCallback);
        },
        streamResolve: <TOut>(oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => AsyncIterable<TOut>, burst?: boolean) => {
            return new StreamingProcedure<TIn, TOut, GlobalState, LocalState>(iCallback, oCallback, burst || false);
        }
    }
}

export class Procedure<TIn, TOut, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    readonly signature = "procedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => TOut | PromiseLike<TOut>
    ) { }

    execute(gState: GlobalState, lState: LocalState, input: TIn) {
        return this.oCallback(gState, lState, this.iCallback(input));
    }
}

export class StreamingProcedure<TIn, TOut, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    readonly signature = "streamingProcedure";
    constructor(
        private iCallback: (input: unknown) => TIn,
        private oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => AsyncIterable<TOut>,
        public burst: boolean
    ) { }

    execute(gState: GlobalState, lState: LocalState, input: TIn) {
        return this.oCallback(gState, lState, this.iCallback(input));
    }
}
