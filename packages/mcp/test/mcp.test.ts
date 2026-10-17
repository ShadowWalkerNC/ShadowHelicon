import test from "node:test";
import assert from "node:assert/strict";
import { ShadowHeliconMcpServer, MCP_TOOLS } from "../src/index.js";

test("MCP Server lists tools conforming to protocol", async () => {
  const server = new ShadowHeliconMcpServer();
  const res = (await server.handleRpcRequest({
    id: 1,
    method: "tools/list",
  })) as { result: { tools: typeof MCP_TOOLS } };

  assert.ok(res.result.tools.length >= 5);
  const names = res.result.tools.map((t) => t.name);
  assert.ok(names.includes("list_projects"));
  assert.ok(names.includes("list_sessions"));
  assert.ok(names.includes("resume_session"));
  assert.ok(names.includes("send_message"));
  assert.ok(names.includes("read_recent_turns"));
});

test("MCP Server initialize handshake", async () => {
  const server = new ShadowHeliconMcpServer();
  const res = (await server.handleRpcRequest({
    id: 2,
    method: "initialize",
  })) as { result: { serverInfo: { name: string; version: string } } };

  assert.equal(res.result.serverInfo.name, "shadowhelicon-mcp");
  assert.equal(res.result.serverInfo.version, "0.22.2");
});

test("MCP Server ping", async () => {
  const server = new ShadowHeliconMcpServer();
  const res = (await server.handleRpcRequest({
    id: 3,
    method: "ping",
  })) as { result: object };

  assert.deepEqual(res.result, {});
});
