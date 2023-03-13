import { connect, Server } from "@badaimweeb/js-protov2d";
import z from "zod";
import { Buffer } from "buffer";
import { DTSocketClient, DTSocketServer, InitProcedureGenerator } from "../index.js";

import pkg from "superdilithium";
const { superDilithium } = pkg;
let keyPair = await superDilithium.keyPair();

let server = new Server({
    port: 0,
    privateKey: Array.from(keyPair.privateKey).map((x) => x.toString(16).padStart(2, "0")).join(""),
    publicKey: Array.from(keyPair.publicKey).map((x) => x.toString(16).padStart(2, "0")).join("")
});

let gState: {
    stored?: number;
} = {};
let pGen = InitProcedureGenerator<{
    stored?: number;
}>(gState);
let dtServer = new DTSocketServer({
    add: pGen
        .input(z.object({ a: z.number(), b: z.number() }))
        .resolve((gState, lState, input) => {
            return input.a + input.b;
        }),
    store: pGen
        .input(z.number())
        .resolve((gState, lState, input) => {
            gState["stored"] = input;
        }),
    get: pGen
        .input(z.void())
        .resolve((gState, lState, input) => {
            return gState["stored"];
        }),
    storeLocal: pGen
        .input(z.number())
        .resolve((gState, lState, input) => {
            lState["stored"] = input;
        }
    ),
    getLocal: pGen
        .input(z.void())
        .resolve((gState, lState, input) => {
            return lState["stored"];
        }
    )
});

// Get port
let port = server.port;
console.log("Server listening on port", port);

server.on("connection", session => {
    dtServer.processSession(session);
});

// Create client
let client1 = await connect({
    url: `ws://localhost:${port}`,
    publicKey: {
        type: "key",
        key: Array.from(keyPair.publicKey).map((x) => x.toString(16).padStart(2, "0")).join("")
    }
});

let client2 = await connect({
    url: `ws://localhost:${port}`,
    publicKey: {
        type: "key",
        key: Array.from(keyPair.publicKey).map((x) => x.toString(16).padStart(2, "0")).join("")
    }
});

let dtClient1 = new DTSocketClient<typeof dtServer>(client1);
let dtClient2 = new DTSocketClient<typeof dtServer>(client2);

let pass = [];

// Test 1
let rng1 = Math.random();
let rng2 = Math.random();
let res = await dtClient1.procedure("add")({ a: rng1, b: rng2 });

pass.push(res === rng1 + rng2);
console.log("Test 1:", res === rng1 + rng2 ? "Passed" : "Failed");
console.log(`- Input: ${rng1} + ${rng2} = ${rng1 + rng2}`);
console.log(`- Output: ${res}`);
console.log();

// Test 2
let rng3 = Math.random();
await dtClient1.procedure("store")(rng3);
let res2 = await dtClient2.procedure("get")();

pass.push(res2 === rng3);
console.log("Test 2:", res2 === rng3 ? "Passed" : "Failed");
console.log(`- Input: ${rng3}`);
console.log(`- Output: ${res2}`);
console.log();

// Test 3
let rng4 = Math.random();
await dtClient1.procedure("storeLocal")(rng4);
let res3 = await dtClient1.procedure("getLocal")();

pass.push(res3 === rng4);
console.log("Test 3:", res3 === rng4 ? "Passed" : "Failed");
console.log(`- Input: ${rng4}`);
console.log(`- Output: ${res3}`);
console.log();

// Test 4
let res4 = await dtClient2.procedure("getLocal")();

pass.push(!res4);
console.log("Test 4:", !res4 ? "Passed" : "Failed");
console.log(`- Output: ${res4}`);
console.log();

// Test 5
let res5 = await dtClient1.procedure("get")();

pass.push(res5 === rng3);
console.log("Test 5:", res5 === rng3 ? "Passed" : "Failed");
console.log(`- Output: ${res5}`);
console.log();

console.log("All tests passed:", pass.every(x => x) ? "Yes" : "No");
process.exit(pass.every(x => x) ? 0 : 1);
