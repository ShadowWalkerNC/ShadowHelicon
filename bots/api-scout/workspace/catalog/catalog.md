# Ecosystem API Catalog

Last Updated: 2026-10-17 06:00:00 UTC

| API Name | Type | Auth | Status | Primary Consumers |
| :--- | :--- | :--- | :--- | :--- |
| Meta Muse Session Protocol | stdio / JSON-RPC | Local Token / Login | Verified | Helicon, ShadowHelicon |
| JOSH Kernel | HTTP REST | Local / Bearer | Contract Validated | Policy Router, System 1 |
| ForgeSatchel | HTTP REST | Machine Auth Token | Contract Validated | Secrets Broker, Machine Registry |
| Meta Graph API | HTTPS REST | OAuth 2.0 User Token | Verified | Post-Pilot |
| Cloudflare API v4 | HTTPS REST | API Token | Verified | Cloudflare OS, Tunnels |
| Supabase Management API | HTTPS REST | Service Role Key | Verified | CulinaryOS, Plated, BibleDesk |
| Tailwind / Typography CDN | Static Asset | Public | Verified | ShadowHelicon UI, Web Client |

## Service Details

### 1. Meta Muse Session Protocol (MSP)
- Transport: `muse serve` child process over stdin/stdout.
- Methods: `session/start`, `session/prompt`, `session/steer`, `session/cancel`, `session/approvalResponse`.
- Protocol Version: 1.4.9 (compatible with `@muse-code/sdk`).

### 2. JOSH Kernel
- Endpoint Contract: `POST /policy`
- Input Schema: `{ action: string, tool: string, params: object, sessionId: string, cwd: string }`
- Output Schema: `{ decision: "allow" | "deny" | "escalate" }`
