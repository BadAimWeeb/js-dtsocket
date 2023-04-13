import { connect, Server, keyGeneration } from "@badaimweeb/js-protov2d";
import z from "zod";
import { DTSocketClient, DTSocketServer, InitProcedureGenerator } from "../index.js";

let k = await keyGeneration();

let server = new Server({
    port: 0,
    privateKey: k.privateKey,
    publicKey: k.publicKey
});

type EventTable = {
    csEvents: {},
    scEvents: {
        test: (a: number) => void
    }
};

let gState: {
    stored?: number;
} = {};
let pGen = InitProcedureGenerator<typeof gState, {}, EventTable>();

const procedureTable = {
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
        }),
    getLocal: pGen
        .input(z.void())
        .resolve((gState, lState, input) => {
            return lState["stored"];
        }),
    streamCounter: pGen
        .input(z.void())
        .streamResolve(async function* (gState, lState, input) {
            for (let i = 0; i < 5; i++) {
                yield i;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }),
    broadcast: pGen
        .input(z.number())
        .resolve((gState, lState, input, server) => {
            server.emit("test", input);
        })
};

// typescript doesn't support partial type inference yet. why
let dtServer = new DTSocketServer<
    typeof gState,
    {},
    EventTable,
    typeof procedureTable
>(procedureTable, gState);

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
        key: k.publicKey
    }
});

let client2 = await connect({
    url: `ws://localhost:${port}`,
    publicKey: {
        type: "hash",
        hash: k.publicKeyHash
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

// Test 6
let res6 = gState.stored;

pass.push(res6 === rng3);
console.log("Test 6:", res6 === rng3 ? "Passed" : "Failed");
console.log(`- Input: ${rng3}`);
console.log(`- Output: ${res6}`);
console.log();

// Test 7
let res7 = dtClient1.streamingProcedure("streamCounter")();
console.log("Test 7:");
let internalCounter = 0;
let localPass = true;
let st = Date.now();
for await (let i of res7) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // stress
    let pass = (i === (internalCounter++));
    console.log(`- Output: ${i}`, pass ? "Passed" : "Failed", `${Date.now() - st}ms`);
    localPass = localPass && pass;
}
console.log("- Exit stream");
localPass = localPass && internalCounter === 5;
pass.push(localPass);
console.log(`Status: ${localPass ? "Passed" : "Failed"}`);
console.log();

// Test 8
let rng5 = Math.random();
let rng6 = Math.random();
let res8 = await dtClient2.p.add({ a: rng5, b: rng6 });

pass.push(res8 === rng5 + rng6);
console.log("Test 8:", res8 === rng5 + rng6 ? "Passed" : "Failed");
console.log(`- Input: ${rng5} + ${rng6} = ${rng5 + rng6}`);
console.log(`- Output: ${res8}`);
console.log();

// Test 9
let res9 = dtClient2.sp.streamCounter();
console.log("Test 9:");
internalCounter = 0;
localPass = true;
st = Date.now();
for await (let i of res9) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // stress
    let pass = (i === (internalCounter++));
    console.log(`- Output: ${i}`, pass ? "Passed" : "Failed", `${Date.now() - st}ms`);
    localPass = localPass && pass;
}
console.log("- Exit stream");
localPass = localPass && internalCounter === 5;
pass.push(localPass);
console.log(`Status: ${localPass ? "Passed" : "Failed"}`);
console.log();

// Test 10
let rng7 = Math.random();
let res10 = new Promise<number>((resolve) => {
    dtClient1.on("test", (data) => {
        resolve(data);
    });
});
let res11 = new Promise<number>((resolve) => {
    dtClient2.on("test", (data) => {
        resolve(data);
    });
});
dtClient1.p.broadcast(rng7);
let res12 = await res10;
let res13 = await res11;
pass.push(res12 === rng7 && res13 === rng7);
console.log("Test 10:", res12 === rng7 && res13 === rng7 ? "Passed" : "Failed");
console.log(`- Input: ${rng7}`);
console.log(`- Output: ${res12} ${res13}`);
console.log();

console.log("All tests passed:", pass.every(x => x) ? "Yes" : "No");
process.exit(pass.every(x => x) ? 0 : 1);
