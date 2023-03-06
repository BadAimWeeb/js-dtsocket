export interface Socket {
    on(event: "data", callback: (qos: 0 | 1, message: Uint8Array) => void): this;
    send(qos: 0 | 1, message: Uint8Array): void;
}
