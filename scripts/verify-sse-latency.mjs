/**
 * Comprehensive Empirical SSE & Latency Verification Harness
 * Challenger 1 (Empirical SSE & Latency Challenger)
 *
 * Verifies:
 * 1. Loopback SSE connection TTFB and hello handshake latency (<1000ms)
 * 2. Cloudflare tunnel simulated headers (CF-Connecting-IP, CF-Ray, X-Forwarded-For, Host: test.trycloudflare.com)
 * 3. HTTP Response Headers ('x-accel-buffering: no', 'content-type: text/event-stream', etc.)
 * 4. Raw wire byte sequence: 2KB pre-padding comment (': ' + 2048 spaces + '\n\n' = 2050 chars / 2050 bytes)
 * 5. Event stream integrity (hello frame, dynamic broadcast event frame, unicode safety)
 * 6. High-concurrency burst (30 simultaneous connections over simulated Cloudflare proxy)
 * 7. Rapid client abort / churn sink cleanup resilience
 * 8. Authenticated Daemon with Bearer token & Cookie over Cloudflare Tunnel
 * 9. URL query parameter robustness (/api/events?tabId=123&clientId=pwa)
 * 10. WHATWG SSE specification parser compliance oracle
 */

import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const { HeliconServer } = require("../packages/server/dist/src/server.js");

function formatMs(ms) {
  return `${ms.toFixed(2)} ms`;
}

async function startServer(options = {}) {
  const server = new HeliconServer({
    port: 0,
    dataDir: ":memory:",
    platform: "win32",
    musePath: "muse",
    exec: async () => ({ stdout: "", exitCode: 127 }),
    tailTiming: { tickMs: 3_600_000 },
    ...options,
  });
  const bound = await server.listen();
  return { server, port: bound.port };
}

function connectSse({ port, path = "/api/events", headers = {}, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    let tSocketConnect = null;
    let tFirstByte = null;
    let tHello = null;
    let responseStatus = null;
    let responseHeaders = null;
    let firstChunk = null;
    let rawBuffer = Buffer.alloc(0);
    let events = [];
    let helloEvent = null;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        req.destroy();
        reject(new Error(`Connection timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        agent: false,
        headers: {
          Accept: "text/event-stream",
          ...headers,
        },
      },
      (res) => {
        responseStatus = res.statusCode;
        responseHeaders = res.headers;

        res.on("data", (chunk) => {
          const now = performance.now();
          if (tFirstByte === null) {
            tFirstByte = now;
            firstChunk = chunk;
          }
          rawBuffer = Buffer.concat([rawBuffer, chunk]);

          // Parse SSE frames from accumulated raw buffer
          const text = rawBuffer.toString("utf8");
          const frames = text.split("\n\n");
          for (let i = 0; i < frames.length - 1; i++) {
            const frame = frames[i];
            if (frame.startsWith(":")) {
              // Comment frame
              continue;
            }
            const lines = frame.split("\n");
            let eventName = "message";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr = line.slice(5).trim();
              }
            }
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                const recordedEvent = { event: eventName, data: parsed, raw: frame };
                events.push(recordedEvent);
                if (eventName === "helicon" && parsed.type === "hello" && !helloEvent) {
                  helloEvent = recordedEvent;
                  tHello = now;
                }
              } catch (e) {
                // Not JSON or partial
              }
            }
          }
        });

        res.on("end", () => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve({
              req,
              res,
              t0,
              tSocketConnect,
              tFirstByte,
              tHello,
              ttfbMs: tFirstByte !== null ? tFirstByte - t0 : null,
              helloLatencyMs: tHello !== null ? tHello - t0 : null,
              responseStatus,
              responseHeaders,
              firstChunk,
              rawBuffer,
              events,
              helloEvent,
            });
          }
        });
      }
    );

    req.on("socket", (socket) => {
      socket.on("connect", () => {
        tSocketConnect = performance.now();
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.end();

    const checkArrival = setInterval(() => {
      if ((helloEvent || responseStatus >= 400) && !settled) {
        clearInterval(checkArrival);
        clearTimeout(timer);
        settled = true;
        resolve({
          req,
          t0,
          tSocketConnect,
          tFirstByte,
          tHello,
          ttfbMs: tFirstByte !== null ? tFirstByte - t0 : null,
          helloLatencyMs: tHello !== null ? tHello - t0 : null,
          responseStatus,
          responseHeaders,
          firstChunk,
          getRawBuffer: () => rawBuffer,
          getEvents: () => events,
          helloEvent,
          close: () => req.destroy(),
        });
      }
    }, 5);
  });
}

/**
 * Standard WHATWG EventSource Parser Oracle
 * Validates that the raw stream parses strictly according to W3C/WHATWG SSE specification.
 */
function parseWhatwgSseStream(rawText) {
  const lines = rawText.split(/\r\n|\r|\n/);
  const events = [];
  const comments = [];
  let currentEvent = { type: "message", data: "" };

  for (const line of lines) {
    if (line === "") {
      // Dispatch event if data buffer non-empty
      if (currentEvent.data.length > 0) {
        events.push({
          type: currentEvent.type,
          data: currentEvent.data.endsWith("\n")
            ? currentEvent.data.slice(0, -1)
            : currentEvent.data,
        });
      }
      currentEvent = { type: "message", data: "" };
    } else if (line.startsWith(":")) {
      comments.push(line.slice(1).trimStart());
    } else if (line.includes(":")) {
      const colonIdx = line.indexOf(":");
      const field = line.slice(0, colonIdx);
      let value = line.slice(colonIdx + 1);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
      if (field === "event") {
        currentEvent.type = value;
      } else if (field === "data") {
        currentEvent.data += value + "\n";
      }
    }
  }
  return { events, comments };
}

async function runEmpiricalVerification() {
  console.log("===============================================================================");
  console.log("       EMPIRICAL SSE STREAMING & LATENCY CHALLENGER VERIFICATION HARNESS       ");
  console.log("===============================================================================\n");

  const { server, port } = await startServer();
  console.log(`[INIT] HeliconServer started on loopback port: ${port}`);

  let testPassed = 0;
  let testFailed = 0;

  function recordPass(testName, details) {
    testPassed++;
    console.log(`  [PASS] ${testName}`);
    if (details) {
      console.log(`         -> ${details}`);
    }
  }

  function recordFail(testName, err) {
    testFailed++;
    console.error(`  [FAIL] ${testName}`);
    console.error(`         -> ${err.message || err}`);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Standard Loopback Connection
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 1: Standard HTTP Loopback ---");
  try {
    const conn = await connectSse({ port });
    const rawWire = conn.getRawBuffer();

    // 1. Status Code
    assert.equal(conn.responseStatus, 200, "HTTP Status must be 200");
    recordPass("HTTP Status Code 200 OK");

    // 2. Unbuffering and SSE Headers
    assert.equal(conn.responseHeaders["content-type"], "text/event-stream", "content-type must be text/event-stream");
    assert.equal(conn.responseHeaders["cache-control"], "no-cache", "cache-control must be no-cache");
    assert.equal(conn.responseHeaders["connection"], "keep-alive", "connection must be keep-alive");
    assert.equal(conn.responseHeaders["x-accel-buffering"], "no", "x-accel-buffering must be 'no'");
    recordPass("Header 'x-accel-buffering: no' present and verified", `Headers: x-accel-buffering=${conn.responseHeaders["x-accel-buffering"]}`);

    // 3. Raw Wire 2KB Pre-padding Verification
    const wireStr = rawWire.toString("utf8");
    assert.ok(wireStr.startsWith(": "), "Wire must start with comment ': '");
    const firstNewlinePos = wireStr.indexOf("\n\n");
    assert.equal(firstNewlinePos, 2050, `Pre-padding block must be exactly 2050 chars before double newline (got ${firstNewlinePos})`);
    const paddingLine = wireStr.slice(0, firstNewlinePos);
    const spaces = paddingLine.slice(2);
    assert.equal(spaces.length, 2048, `Padding must contain exactly 2048 spaces (got ${spaces.length})`);
    assert.ok(/^ +$/.test(spaces), "Padding must consist entirely of spaces");
    recordPass("Wire Pre-Padding Verification", `Exact length: ${paddingLine.length} bytes (2 bytes ': ' + ${spaces.length} spaces + 2 bytes '\\n\\n')`);

    // 4. Time To First Byte (TTFB) & Latency
    assert.ok(conn.ttfbMs !== null, "TTFB must be measured");
    assert.ok(conn.helloLatencyMs !== null, "Hello handshake latency must be measured");
    assert.ok(conn.helloLatencyMs < 1000, `Hello handshake latency must be <1,000ms (got ${conn.helloLatencyMs}ms)`);
    recordPass(
      "TTFB & Handshake Latency (<1,000ms criterion)",
      `TTFB: ${formatMs(conn.ttfbMs)}, Handshake: ${formatMs(conn.helloLatencyMs)}`
    );

    // 5. Hello Event Payload Integrity
    assert.ok(conn.helloEvent, "hello event must be received");
    assert.equal(conn.helloEvent.event, "helicon", "hello event name must be 'helicon'");
    assert.equal(conn.helloEvent.data.type, "hello", "data.type must be 'hello'");
    assert.equal(conn.helloEvent.data.version, "0.22.2", "data.version must match HELICON_VERSION");
    recordPass("Hello Handshake Event Payload Integrity", `Payload: ${JSON.stringify(conn.helloEvent.data)}`);

    conn.close();
  } catch (err) {
    recordFail("Standard HTTP Loopback Suite", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Cloudflare Proxy Headers Simulation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: Simulated Cloudflare Quick Tunnel / Edge Proxy Headers ---");
  try {
    const cfHeaders = {
      "CF-Connecting-IP": "198.51.100.42",
      "CF-Ray": "8d3e2109ab7f-DFW",
      "CF-Visitor": '{"scheme":"https"}',
      "X-Forwarded-For": "198.51.100.42, 172.70.130.40",
      "X-Forwarded-Proto": "https",
      Host: "test.trycloudflare.com",
    };

    const conn = await connectSse({ port, headers: cfHeaders });
    const rawWire = conn.getRawBuffer();

    assert.equal(conn.responseStatus, 200, "HTTP Status must be 200 under Cloudflare headers");
    assert.equal(conn.responseHeaders["x-accel-buffering"], "no", "x-accel-buffering must be 'no' under Cloudflare headers");
    recordPass("Cloudflare Headers: Response status 200 & x-accel-buffering: no verified");

    // Wire padding check
    const wireStr = rawWire.toString("utf8");
    assert.ok(wireStr.startsWith(": "), "Wire must start with ': ' under Cloudflare headers");
    const firstNewlinePos = wireStr.indexOf("\n\n");
    assert.equal(firstNewlinePos, 2050, `Padding line must be 2050 chars (got ${firstNewlinePos})`);
    recordPass("Cloudflare Headers: 2KB Wire Pre-padding confirmed");

    // Latency check
    assert.ok(conn.helloLatencyMs < 1000, `Cloudflare Hello handshake latency must be <1000ms (got ${conn.helloLatencyMs}ms)`);
    recordPass(
      "Cloudflare Headers: Latency strictly < 1,000ms",
      `TTFB: ${formatMs(conn.ttfbMs)}, Handshake: ${formatMs(conn.helloLatencyMs)}`
    );

    // Payload check
    assert.equal(conn.helloEvent.data.type, "hello");
    assert.equal(conn.helloEvent.data.version, "0.22.2");
    recordPass("Cloudflare Headers: Hello Event undamaged", `Version: ${conn.helloEvent.data.version}`);

    conn.close();
  } catch (err) {
    recordFail("Cloudflare Proxy Headers Simulation", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Dynamic Event Stream Delivery & Wire Integrity
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: Dynamic Event Stream Delivery & Wire Integrity ---");
  try {
    const conn = await connectSse({ port });
    assert.ok(conn.helloEvent, "Hello event established");

    // Broadcast a custom event from the server
    const broadcastEventName = "challenger_stress_event";
    const broadcastPayload = {
      testId: "CF-SSE-9999",
      timestamp: Date.now(),
      nested: { status: "OK", count: 42, active: true },
      unicodeCheck: "Helicon 🚀 Stream ⚡ Unbuffered ✓",
    };

    server["emit"](broadcastEventName, broadcastPayload);

    // Wait for the event to be received by the client
    const eventReceived = await new Promise((resolve, reject) => {
      const startWait = performance.now();
      const interval = setInterval(() => {
        const matching = conn.getEvents().find((e) => e.event === broadcastEventName);
        if (matching) {
          clearInterval(interval);
          resolve({ event: matching, elapsedMs: performance.now() - startWait });
        } else if (performance.now() - startWait > 2000) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for broadcast event"));
        }
      }, 5);
    });

    assert.deepEqual(eventReceived.event.data, broadcastPayload, "Broadcast payload must match verbatim");
    recordPass(
      "Subsequent Event Stream Broadcast Delivered Undamaged",
      `Event: '${broadcastEventName}', Delivery time: ${formatMs(eventReceived.elapsedMs)}, Unicode: '${eventReceived.event.data.unicodeCheck}'`
    );

    conn.close();
  } catch (err) {
    recordFail("Subsequent Event Stream Delivery", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: High-Concurrency Burst (30 Simultaneous Connections)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: High-Concurrency Burst (30 Simultaneous Connections) ---");
  try {
    const CONCURRENCY = 30;
    const cfHeaders = {
      "CF-Connecting-IP": "198.51.100.42",
      "CF-Ray": "8d3e2109ab7f-DFW",
      "X-Forwarded-For": "198.51.100.42",
      Host: "stress.trycloudflare.com",
    };

    const startTime = performance.now();
    const connectionPromises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      connectionPromises.push(connectSse({ port, headers: cfHeaders }));
    }

    const results = await Promise.all(connectionPromises);
    const totalBatchTime = performance.now() - startTime;

    const ttfbList = results.map((r) => r.ttfbMs).sort((a, b) => a - b);
    const latencyList = results.map((r) => r.helloLatencyMs).sort((a, b) => a - b);

    const minTtfb = ttfbList[0];
    const maxTtfb = ttfbList[ttfbList.length - 1];
    const meanTtfb = ttfbList.reduce((acc, v) => acc + v, 0) / ttfbList.length;

    const minLat = latencyList[0];
    const maxLat = latencyList[latencyList.length - 1];
    const meanLat = latencyList.reduce((acc, v) => acc + v, 0) / latencyList.length;
    const p95Lat = latencyList[Math.floor(latencyList.length * 0.95)];

    assert.equal(results.length, CONCURRENCY, `All ${CONCURRENCY} connections must succeed`);
    for (const r of results) {
      assert.equal(r.responseHeaders["x-accel-buffering"], "no");
      assert.ok(r.helloLatencyMs < 1000, `Every latency must be <1000ms (max was ${r.helloLatencyMs}ms)`);
      assert.equal(r.helloEvent.data.type, "hello");
    }

    recordPass(
      `All ${CONCURRENCY} concurrent SSE streams completed with 100% success and <1,000ms latency`,
      `Batch Duration: ${formatMs(totalBatchTime)} | Latency: min=${formatMs(minLat)}, mean=${formatMs(meanLat)}, p95=${formatMs(p95Lat)}, max=${formatMs(maxLat)}`
    );

    // Clean up all connections and wait for sinks to drain
    results.forEach((r) => r.close());
    await new Promise((r) => setTimeout(r, 100));
  } catch (err) {
    recordFail("High-Concurrency Burst Suite", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Rapid Client Abort / Connection Churn Resilience
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: Rapid Client Abort / Churn Sink Cleanup ---");
  try {
    const initialSinkCount = server["sinks"].size;
    const CHURN_COUNT = 15;

    for (let i = 0; i < CHURN_COUNT; i++) {
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: "/api/events",
        method: "GET",
        headers: { Accept: "text/event-stream" },
      });
      req.on("response", (res) => {
        // Abort socket immediately upon receiving first chunk or headers
        res.destroy();
      });
      req.on("error", () => {});
      req.end();
    }

    // Wait 200ms for close events to settle
    await new Promise((r) => setTimeout(r, 200));

    const finalSinkCount = server["sinks"].size;
    assert.equal(finalSinkCount, initialSinkCount, `Server sinks must return to baseline (${initialSinkCount}), got ${finalSinkCount}`);
    recordPass("Rapid Client Aborts Cleaned Up Without Sink Leak", `Sinks: before=${initialSinkCount}, after=${finalSinkCount}`);
  } catch (err) {
    recordFail("Rapid Client Abort Resilience", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Query Parameter Robustness
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 6: Query Parameter Robustness ---");
  try {
    const conn = await connectSse({
      port,
      path: "/api/events?tabId=9876&client=mobile-web&ts=" + Date.now(),
      headers: { Host: "test.trycloudflare.com" },
    });
    assert.equal(conn.responseStatus, 200);
    assert.equal(conn.responseHeaders["x-accel-buffering"], "no");
    assert.ok(conn.helloEvent, "hello event received on route with query parameters");
    recordPass("Route '/api/events?<query>' correctly dispatches and responds", `Latency: ${formatMs(conn.helloLatencyMs)}`);
    conn.close();
  } catch (err) {
    recordFail("Query Parameter Robustness", err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 7: WHATWG EventSource Protocol Compliance Oracle
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 7: WHATWG EventSource Protocol Compliance Oracle ---");
  try {
    const conn = await connectSse({ port });
    // Broadcast an event with special chars
    server["emit"]("whatwg_test", { valid: true, payload: "foo\nbar" });
    await new Promise((r) => setTimeout(r, 50));

    const wireText = conn.getRawBuffer().toString("utf8");
    const { events, comments } = parseWhatwgSseStream(wireText);

    assert.ok(comments.length >= 1, "Must contain at least 1 comment frame");
    assert.equal(comments[0].length, 0, "Comment is whitespace spaces (trimStart yields empty)");

    const helloEvt = events.find((e) => e.type === "helicon");
    assert.ok(helloEvt, "WHATWG parser must extract 'helicon' event");
    const parsedHello = JSON.parse(helloEvt.data);
    assert.equal(parsedHello.type, "hello");

    recordPass(
      "WHATWG EventSource Spec Parser Verification",
      `Comments parsed: ${comments.length}, Events dispatched: ${events.length}, Hello parsed cleanly.`
    );
    conn.close();
  } catch (err) {
    recordFail("WHATWG EventSource Protocol Compliance Oracle", err);
  }

  // Close unauthenticated server
  await server.close();

  // ---------------------------------------------------------------------------
  // TEST SUITE 8: Authenticated Daemon over Cloudflare Tunnel
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 8: Authenticated Daemon over Cloudflare Tunnel ---");
  try {
    const TOKEN = "sec_c1_token_778899";
    const authServerSetup = await startServer({ token: TOKEN });
    const authPort = authServerSetup.port;

    // 1. Request without token -> should be 401
    const unauthConn = await connectSse({
      port: authPort,
      headers: { Host: "secure.trycloudflare.com" },
    });
    assert.equal(unauthConn.responseStatus, 401, "Unauthenticated request must receive 401");
    recordPass("Unauthenticated request properly rejected with 401 Unauthorized");

    // 2. Request with Bearer token over Cloudflare Tunnel -> should be 200 with unbuffering
    const bearerConn = await connectSse({
      port: authPort,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "CF-Connecting-IP": "198.51.100.42",
        "CF-Ray": "8d3e2109ab7f-DFW",
        Host: "secure.trycloudflare.com",
      },
    });
    assert.equal(bearerConn.responseStatus, 200, "Bearer authenticated request must succeed with 200");
    assert.equal(bearerConn.responseHeaders["x-accel-buffering"], "no", "x-accel-buffering must be present");
    assert.ok(bearerConn.helloLatencyMs < 1000, `Bearer latency must be <1000ms (got ${bearerConn.helloLatencyMs}ms)`);
    assert.equal(bearerConn.helloEvent.data.type, "hello");
    recordPass(
      "Bearer Authenticated SSE over Cloudflare Tunnel Verified",
      `Latency: ${formatMs(bearerConn.helloLatencyMs)}, Status: 200, x-accel-buffering: ${bearerConn.responseHeaders["x-accel-buffering"]}`
    );
    bearerConn.close();

    // 3. Request with Cookie authentication over Cloudflare Tunnel
    const cookieConn = await connectSse({
      port: authPort,
      headers: {
        Cookie: `helicon_token=${encodeURIComponent(TOKEN)}`,
        "CF-Connecting-IP": "198.51.100.42",
        Host: "secure.trycloudflare.com",
      },
    });
    assert.equal(cookieConn.responseStatus, 200, "Cookie authenticated request must succeed with 200");
    assert.equal(cookieConn.responseHeaders["x-accel-buffering"], "no");
    assert.ok(cookieConn.helloLatencyMs < 1000);
    assert.equal(cookieConn.helloEvent.data.type, "hello");
    recordPass(
      "Cookie Authenticated SSE over Cloudflare Tunnel Verified",
      `Latency: ${formatMs(cookieConn.helloLatencyMs)}, Status: 200`
    );
    cookieConn.close();

    await authServerSetup.server.close();
  } catch (err) {
    recordFail("Authenticated Daemon Suite", err);
  }

  console.log("\n===============================================================================");
  console.log(`                     VERIFICATION SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED                    `);
  console.log("===============================================================================\n");

  if (testFailed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runEmpiricalVerification().catch((err) => {
  console.error("FATAL ERROR in verification harness:", err);
  process.exit(1);
});
