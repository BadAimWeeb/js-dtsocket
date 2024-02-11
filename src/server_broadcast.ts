import type { DTSocketServer } from "./server.js";
import type { GetTypeContext, ServerContext, SymbolEventTableType } from "./types.js";

export interface DTSocketServer_BroadcastOperator<Context extends ServerContext> {
    emit<T extends keyof GetTypeContext<Context, SymbolEventTableType>["scEvents"]>(event: T, ...args: Parameters<GetTypeContext<Context, SymbolEventTableType>["scEvents"][T]>): boolean;
    emit(event: string, ...args: any[]): boolean;
}

export class DTSocketServer_BroadcastOperator<Context extends ServerContext> {
    constructor(private server: DTSocketServer<Context>, public rooms: string[], public excludeSockets: string[] = []) { }

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
            try {
                this.server.cSockets.get(socket)?.emit(event, ...args);
            } catch { }
        }

        return true;
    }

    to(room: string | string[]): DTSocketServer_BroadcastOperator<Context> {
        return new DTSocketServer_BroadcastOperator(this.server, this.rooms.concat(room), this.excludeSockets);
    }
}
