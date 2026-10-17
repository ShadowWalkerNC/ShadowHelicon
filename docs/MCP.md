# ShadowHelicon Model Context Protocol (MCP) Server

The ShadowHelicon MCP server enables external autonomous agents, personal bots, and scripts to inspect projects and drive coding sessions programmatically over standard Model Context Protocol (MCP) using a stdio transport.

## Overview

- **Package**: `@helicon/mcp` (`packages/mcp`)
- **Executable**: `npx shadowhelicon-mcp` or `node packages/mcp/dist/src/cli.js`
- **Transport**: Standard Input/Output (`stdio`), JSON-RPC 2.0
- **Default Gateway**: `http://127.0.0.1:3127` (configurable via `HELICON_URL` environment variable) with automatic fallback to local SQLite (`~/.helicon/helicon.db`).

## Configuration for External Agent Clients

To register ShadowHelicon with Claude Desktop, Cursor, Antigravity, or other MCP clients, add the server to your client configuration:

```json
{
  "mcpServers": {
    "shadowhelicon": {
      "command": "node",
      "args": [
        "C:\\Users\\white\\OneDrive\\Documents\\GitHub\\ShadowHelicon\\packages\\mcp\\dist\\src\\cli.js"
      ],
      "env": {
        "HELICON_URL": "http://127.0.0.1:3127"
      }
    }
  }
}
```

## Available Tools

### 1. `list_projects`
Returns all registered and pre-seeded coding projects in ShadowHelicon, including paths, display names, categories, and private flags.

**Parameters:**
- `includeHidden` *(boolean, optional)*: Include projects marked as hidden. Default: `false`.

**Response Example:**
```json
[
  {
    "id": 1,
    "cwd": "C:\\Users\\white\\OneDrive\\Documents\\GitHub\\CulinaryOS",
    "displayName": "CulinaryOS",
    "category": "Food & Hospitality",
    "private": false,
    "pinned": false
  }
]
```

### 2. `list_sessions`
List active and past coding sessions, optionally filtered by a repository working directory.

**Parameters:**
- `cwd` *(string, optional)*: The repository working directory to filter sessions by.
- `limit` *(number, optional)*: Maximum number of sessions to return. Default: `50`.

**Response Example:**
```json
[
  {
    "id": "session_01J...",
    "projectId": 1,
    "title": "Fix recipe ratio calculations",
    "status": "ready",
    "turnCount": 4,
    "activityAt": "2026-10-17T06:30:00.000Z"
  }
]
```

### 3. `resume_session`
Resume or inspect an existing session by its unique ID. Returns complete session state and working directory.

**Parameters:**
- `sessionId` *(string, required)*: The unique ID of the session to resume.

### 4. `send_message`
Sends a prompt or instruction to a coding session and returns the turn acknowledgment.

**Parameters:**
- `sessionId` *(string, required)*: Target session ID.
- `message` *(string, required)*: Instruction text or user prompt to send to the agent.
- `modelId` *(string, optional)*: Optional model ID override (e.g. `muse-spark-1.3`).

### 5. `read_recent_turns`
Reads recent conversation turns, steps, tool runs, diffs, and outputs from a session transcript.

**Parameters:**
- `sessionId` *(string, required)*: The session ID to inspect.
- `limit` *(number, optional)*: Maximum number of recent turns to return. Default: `10`.
