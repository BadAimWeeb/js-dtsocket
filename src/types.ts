import type EventEmitter from "events";

type ConditionalSend<T extends (0 | 1)> = T extends 1 ? Promise<void> : T extends 0 ? void : never;

export interface Socket extends EventEmitter {
    connectionPK: string;

    on(event: "data", callback: (qos: 0 | 1, message: Uint8Array) => void): this;
    on(event: "resumeFailed", callback: (newSocket: Socket) => void): this;
    send<T extends 0 | 1>(qos: T, message: Uint8Array): ConditionalSend<T>;
}

export type EventType<T extends object> = {
    [K in keyof T]: T[K] extends (...args: infer RT) => void ? RT : never
};

export type CSEventTable<T extends { csEvents: { [event: string]: (...args: any[]) => void } }> = EventType<T["csEvents"]>;
export type SCEventTable<T extends { scEvents: { [event: string]: (...args: any[]) => void } }> = EventType<T["scEvents"]>;
