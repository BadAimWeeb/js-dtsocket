export class OldConnectionClosedError extends Error {
    constructor() {
        super();

        this.message = "Old connection closed.";
        this.name = "OldConnectionClosedError";       
    }
}

export class RemoteError extends Error {
    constructor(public message: string) {
        super();

        this.name = "RemoteError";
    }
}
