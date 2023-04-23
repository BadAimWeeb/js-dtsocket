import type { DTSocketServer } from "./server";

export interface DTSocketServer_BroadcastOperator<
    EventTable extends {
        csEvents: {
            [event: string]: (...args: any[]) => void
        },
        scEvents: {
            [event: string]: (...args: any[]) => void
        }
    }
> {
    emit<T extends keyof EventTable["scEvents"]>(event: T, ...args: Parameters<EventTable["scEvents"][T]>): boolean;
    emit(event: string, ...args: any[]): boolean;
}

export class DTSocketServer_BroadcastOperator<
    EventTable extends {
        csEvents: {
            [event: string]: (...args: any[]) => void
        },
        scEvents: {
            [event: string]: (...args: any[]) => void
        }
    }
> {
    constructor(private server: DTSocketServer<any, any, EventTable, any>, public rooms: string[], public excludeSockets: string[] = []) { }

    emit(event: string, ...args: any[]) {
        let sockets = new Set<string>();
        for (const room of this.rooms) {
            for (const socket of this.server.rooms.get(room) || []) {
                sockets.add(socket);
            }
        }

        for (const socket of this.excludeSockets) {
            sockets.delete(socket);
        }

        for (const socket of sockets) {
            this.server.cSockets.get(socket)?.emit(event, ...args);
        }

        return true;
    }

    to(room: string | string[]) {
        return new DTSocketServer_BroadcastOperator(this.server, this.rooms.concat(room), this.excludeSockets);
    }
}
