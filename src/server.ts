import type { Procedure } from "./procedure.js";
import type { Socket } from "./types.js";

export class DTSocketServer<
    GlobalState extends {
        [key: string]: any
    },
    LocalState extends {
        [key: string]: any
    },
    T extends {
        [api: string]: Procedure<any, any>
    }
> {
    globalState: GlobalState;
    localState: Map<Socket, LocalState>;
    private handler: T;

    constructor(handler: T) {
        this.handler = handler;
    }

    async processSession() {

    }
}