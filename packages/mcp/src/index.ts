import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { HeliconStore } from "@helicon/daemon";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "list_projects",
    description: "List all registered and pre-seeded coding projects in ShadowHelicon.",
    inputSchema: {
      type: "object",
      properties: {
        includeHidden: { type: "boolean", description: "Whether to include hidden projects" },
      },
    },
  },
  {
    name: "list_sessions",
    description: "List active and historical coding sessions, optionally filtered by project cwd.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Filter sessions by project working directory" },
        limit: { type: "number", description: "Maximum number of sessions to return" },
      },
    },
  },
  {
    name: "resume_session",
    description: "Resume or fetch metadata for an existing coding session by its sessionId.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "The session ID to resume" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "send_message",
    description: "Send a user message/prompt to an active or resumed coding session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "The target session ID" },
        message: { type: "string", description: "The prompt or message text to send to the agent" },
        modelId: { type: "string", description: "Optional model ID override" },
      },
      required: ["sessionId", "message"],
    },
  },
  {
    name: "read_recent_turns",
    description: "Read recent turns, steps, diffs, and outputs from a session transcript.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "The session ID to inspect" },
        limit: { type: "number", description: "Maximum number of recent turns to return" },
      },
      required: ["sessionId"],
    },
  },
];

export interface McpServerOptions {
  serverUrl?: string;
  dataDir?: string;
}

export class ShadowHeliconMcpServer {
  private readonly serverUrl: string;
  private readonly dataDir: string;
  private store: HeliconStore | null = null;

  constructor(options: McpServerOptions = {}) {
    this.serverUrl = options.serverUrl ?? process.env["HELICON_URL"] ?? "http://127.0.0.1:3127";
    this.dataDir = options.dataDir ?? join(homedir(), ".helicon");
  }

  private getStore(): HeliconStore {
    if (!this.store) {
      this.store = new HeliconStore(this.dataDir);
    }
    return this.store;
  }

  private async fetchApi(path: string, init?: RequestInit): Promise<unknown> {
    try {
      const res = await fetch(`${this.serverUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${await res.text()}`);
      }
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  async listProjects(includeHidden = false): Promise<unknown> {
    const apiResult = await this.fetchApi("/api/projects");
    if (apiResult && typeof apiResult === "object" && "projects" in apiResult) {
      return (apiResult as { projects: unknown }).projects;
    }
    // Fall back to direct store
    const store = this.getStore();
    return store.listProjects({ includeHidden });
  }

  async listSessions(cwd?: string, limit = 50): Promise<unknown> {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
    const apiResult = await this.fetchApi(`/api/sessions${query}`);
    if (apiResult && typeof apiResult === "object" && "sessions" in apiResult) {
      return (apiResult as { sessions: unknown }).sessions;
    }
    const store = this.getStore();
    if (cwd) {
      const project = store.getProject(cwd);
      if (!project) return [];
      return store.listSessionsByProject(project.id).slice(0, limit);
    }
    const projects = store.listProjects();
    const all = projects.flatMap((p) => store.listSessionsByProject(p.id));
    return all.slice(0, limit);
  }

  async resumeSession(sessionId: string): Promise<unknown> {
    const apiResult = await this.fetchApi(`/api/sessions/${encodeURIComponent(sessionId)}`);
    if (apiResult) {
      return apiResult;
    }
    const store = this.getStore();
    const session = store.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }
    return session;
  }

  async sendMessage(sessionId: string, message: string, modelId?: string): Promise<unknown> {
    const body: Record<string, unknown> = {
      text: message,
      ifBusy: "queue",
    };
    if (modelId) {
      body["modelId"] = modelId;
    }
    const result = await this.fetchApi(`/api/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!result) {
      throw new Error(
        `Failed to send message to session ${sessionId}. Ensure the ShadowHelicon daemon is running on ${this.serverUrl}.`,
      );
    }
    return result;
  }

  async readRecentTurns(sessionId: string, limit = 10): Promise<unknown> {
    const apiResult = await this.fetchApi(`/api/sessions/${encodeURIComponent(sessionId)}/turns?limit=${limit}`);
    if (apiResult) {
      return apiResult;
    }
    const store = this.getStore();
    const session = store.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }
    return {
      sessionId,
      title: session.title,
      turnCount: session.turnCount,
      status: session.status,
      activityAt: session.activityAt,
    };
  }

  async handleCallTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    switch (name) {
      case "list_projects": {
        const includeHidden = args["includeHidden"] === true;
        return await this.listProjects(includeHidden);
      }
      case "list_sessions": {
        const cwd = typeof args["cwd"] === "string" ? args["cwd"] : undefined;
        const limit = typeof args["limit"] === "number" ? args["limit"] : 50;
        return await this.listSessions(cwd, limit);
      }
      case "resume_session": {
        const sessionId = String(args["sessionId"] ?? "");
        if (!sessionId) {
          throw new Error("sessionId is required");
        }
        return await this.resumeSession(sessionId);
      }
      case "send_message": {
        const sessionId = String(args["sessionId"] ?? "");
        const message = String(args["message"] ?? "");
        const modelId = typeof args["modelId"] === "string" ? args["modelId"] : undefined;
        if (!sessionId || !message) {
          throw new Error("sessionId and message are required");
        }
        return await this.sendMessage(sessionId, message, modelId);
      }
      case "read_recent_turns": {
        const sessionId = String(args["sessionId"] ?? "");
        const limit = typeof args["limit"] === "number" ? args["limit"] : 10;
        if (!sessionId) {
          throw new Error("sessionId is required");
        }
        return await this.readRecentTurns(sessionId, limit);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async handleRpcRequest(request: { id?: string | number; method: string; params?: unknown }): Promise<unknown> {
    const { id, method, params } = request;
    const p = (params ?? {}) as Record<string, unknown>;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "shadowhelicon-mcp",
              version: "0.22.2",
            },
          },
        };

      case "notifications/initialized":
        return null;

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case "tools/call": {
        const toolName = String(p["name"] ?? "");
        const toolArgs = (p["arguments"] ?? {}) as Record<string, unknown>;
        try {
          const content = await this.handleCallTool(toolName, toolArgs);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
                },
              ],
            },
          };
        } catch (err) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: String(err instanceof Error ? err.message : err),
                },
              ],
            },
          };
        }
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  }

  startStdio(): void {
    let buffer = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      buffer += chunk;
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        try {
          const parsed = JSON.parse(line) as { id?: string | number; method: string; params?: unknown };
          void this.handleRpcRequest(parsed).then((response) => {
            if (response !== null && response !== undefined) {
              process.stdout.write(JSON.stringify(response) + "\n");
            }
          });
        } catch (err) {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            }) + "\n",
          );
        }
      }
    });
  }
}
