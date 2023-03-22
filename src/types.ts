type ConditionalSend<T extends (0 | 1)> = T extends 1 ? Promise<void> : T extends 0 ? void : never;

export interface Socket {
    on(event: "data", callback: (qos: 0 | 1, message: Uint8Array) => void): this;
    send<T extends 0 | 1>(qos: T, message: Uint8Array): ConditionalSend<T>;
}
