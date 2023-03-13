export const InitProcedureGenerator = <
    LocalState extends { [key: string]: any } = {}, 
    GlobalState extends { [key: string]: any } = {}
>(gState: GlobalState) => {
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
        }
    }
}

export class Procedure<TIn, TOut, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    constructor(private iCallback: (input: unknown) => TIn, private oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => TOut | PromiseLike<TOut>) { }

    async execute(gState: GlobalState, lState: LocalState, input: TIn) {
        return this.oCallback(gState, lState, this.iCallback(input));
    }
}
