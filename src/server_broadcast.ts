import type { DTSocketServerInterface } from "./server.js";
import type { GetTypeContext, ServerContext, SymbolEventTableType } from "./types.js";

export interface DTSocketServer_BroadcastOperator<Context extends ServerContext> {
    emit<T extends keyof GetTypeContext<Context, SymbolEventTableType>["scEvents"]>(event: T, ...args: Parameters<GetTypeContext<Context, SymbolEventTableType>["scEvents"][T]>): boolean;
}

export class DTSSBOImpl {
    constructor(private server: DTSocketServerInterface, public rooms: string[], public excludeSockets: string[] = []) { }

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

    to(room: string | string[]) {
        return new DTSSBOImpl(this.server, this.rooms.concat(room), this.excludeSockets);
    }
}
