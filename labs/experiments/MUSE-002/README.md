# MUSE-002 — Read-only MCP contract simulation

Local stdlib Node prototype using synthetic fixtures. No external Meta connector, real MCP transport, database access, provider authentication or physical device is connected. Request version 1 is this experiment contract, not a claim of MCP wire-protocol compliance.

Run `node --test implementation/connector.test.mjs` from this directory. Source and tests are under implementation/. Read permissions are supplied by the host, never accepted from the request. Unsupported operations are rejected before callbacks. No production promotion or SDK adoption is authorized.
