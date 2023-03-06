export const procedure = {
    input: <TIn>(iCallback: (input: unknown) => TIn) => {
        return createProcedure<TIn>(iCallback);
    }
}

function createProcedure<TIn>(iCallback: (input: unknown) => TIn) {
    return {
        resolve: <GlobalState, LocalState, TOut>(oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => PromiseLike<TOut>) => {
            return new Procedure<TIn, TOut>(iCallback, oCallback);
        }
    }
}

export class Procedure<TIn, TOut, GlobalState extends { [key: string]: any } = {}, LocalState extends { [key: string]: any } = {}> {
    constructor(private iCallback: (input: unknown) => TIn, private oCallback: (gState: GlobalState, lState: LocalState, input: TIn) => PromiseLike<TOut>) { }

    async execute(gState: GlobalState, lState: LocalState, input: TIn) {
        return this.oCallback(gState, lState, this.iCallback(input));
    }
}
