# DTSocket: Move fast and break nothing

## What is this?

DTSocket is a application layer protocol (Layer 7 in OSI) that is built on top of ProtoV2/V2d (L4/5).

This package is inspired by [tRPC](https://github.com/trpc/trpc), but rather than sending through HTTP, it sends through ProtoV2/V2d.

Compatible with [js-protov2d](https://github.com/BadAimWeeb/js-protov2d)`@1`.

## Usage

Create server:
```ts
// Create ProtoV2d server
import { Server, type Session } from "@badaimweeb/js-protov2d";
import z from "zod";
import { InitProcedureGenerator, DTSocketServer, type ServerContext } from "@badaimweeb/js-dtsocket";

let v2dServer = new Server({
    port: 0,
    privateKey,
    publicKey // see js-protov2d for more info
});

// .on and .emit events. csEvents are events that the client can emit, and scEvents are events that the server can emit.
type EventTable = {
    csEvents: {
        test: (a: number) => void
    },
    scEvents: {
        test: (a: number) => void
    }
};

// This will be the global object that all procedures will have access to.
const gState: {
    stored?: number;
} = {};

type LState = {
    // You can put data that is connection/session-specific here.
}

let pGen = InitProcedureGenerator<ServerContext<typeof gState, LState, EventTable, Session>>();

// The procedure table
const procedureTable = {
    normal: pGen
        .input(z.object({ a: z.number(), b: z.number() }))
        .resolve((gState, lState, input, socket) => {
            return input.a + input.b;
        }),

    streaming: pGen
        .input(z.void())
        .resolve(async function* (gState, lState, input) {
            for (let i = 0; i < 10; i++) {
                yield i;
            }
        })
}

// And create the DTSocket server...
const dtServer = new DTSocketServer<ServerContext<typeof gState, LState, EventTable, Session, typeof procedureTable>>(procedureTable, gState);

// ...and exporting definitions for client to use.
export type ServerDef = typeof dtServer;

// Handle client connection
v2dServer.on("connection", async (socket) => {
    // Upgrade to DTSocket
    let dtSocket = await dtServer.upgrade(socket);

    // Handle client events
    dtSocket.on("test", (a) => {
        console.log(a);

        // Emit server event
        dtSocket.emit("test", a);
    });
});
```

Client to server:
```ts
import { connect, Session } from "@badaimweeb/js-protov2d";
import { DTSocketClient } from "@badaimweeb/js-dtsocket";
import type { ServerDef } from "server_somewhere";

// Connect to remote server using ProtoV2d...
let client = await connect({
    url: `ws://address.here`,
    publicKeys: [{
        type: "key" | "hash",
        value: "something"
    }]
});

// ...and then upgrading to DTSocket...
let dtClient = new DTSocketClient<ServerDef>(client);

// Client can now use the procedures defined in the server.
let result = await dtClient.p.normal({ a: 1, b: 2 });
// or...
let result = await dtClient.procedure("normal")({ a: 1, b: 2 });


// Streaming/server events? No problem!
let stream = dtClient.sp.streaming();
// or...
let stream = dtClient.streamingProcedure("streaming")();

for await (let i of stream) {
    console.log(i);
}

// Transmitting events? Also no problem!
dtClient.emit("test", 1);

// and listening to server events...
dtClient.on("test", (a) => {
    console.log(a);
});
```