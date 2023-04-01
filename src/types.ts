import type EventEmitter from "events";

type ConditionalSend<T extends (0 | 1)> = T extends 1 ? Promise<void> : T extends 0 ? void : never;

export interface Socket extends EventEmitter {
    on(event: "data", callback: (qos: 0 | 1, message: Uint8Array) => void): this;
    on(event: "resumeFailed", callback: (newSocket: Socket) => void): this;
    send<T extends 0 | 1>(qos: T, message: Uint8Array): ConditionalSend<T>;
}
