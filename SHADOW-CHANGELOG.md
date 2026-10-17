# ShadowHelicon Changelog

This document tracks all customizations made on the `shadowhelicon` branch relative to upstream `HarjjotSinghh/helicon` (default branch `prod`).

---

## 1. Project Pre-Seed & Dynamic Configuration

- **`projects.config.json`** (New File):
  - Central configuration file defining 35 pre-seeded developer projects across Personal, Hospitality, Infrastructure, Gaming, and Private categories.
  - devRoot set to `C:\Users\white\OneDrive\Documents\GitHub\`.
  - Configurable without code changes.
- **`packages/server/src/projectsConfig.ts`** (New File):
  - Resolves `projects.config.json` location and synchronizes configured projects into the local SQLite store.
- **`packages/server/src/server.ts`**:
  - Automatically syncs projects on `GET /api/projects` and serves `category` and `isPrivate` flags.

---

## 2. Labs Absorption (MuseLab R&D Framework)

- **`labs/experiments/`** (New Directory):
  - Absorbed experiment templates and lifecycle documentation (`EXPERIMENT.template.md`, `LIFECYCLE.md`, `registry.json`).
  - Absorbed reference experiments: `MUSE-001` (coding capability benchmark), `MUSE-002` (model context compaction), `MUSE-003` (subagent orchestration).
- **`labs/tooling/`** (New Directory):
  - Standalone verification and test runner utilities (`selftest.mjs`).
- **`packages/server/src/labs.ts`** (New File):
  - Backend API services for listing experiments, reading artifacts, creating new experiments from templates, running Node test harnesses, and writing results back to `results.md` and `benchmarks.json`.
- **`packages/ui/src/pages/LabsPage.tsx`** (New File):
  - Dedicated Labs UI panel with experiment list, lifecycle badges, markdown artifact viewers (`hypothesis.md`, `results.md`, `benchmarks.json`, `decision.md`), and inline Node harness runner with exit code and stdout/stderr capture.

---

## 3. Personal Bots System Absorption

- **`bots/`** (New Directory):
  - Pre-seeded bot configurations: `api-scout`, `culinaryos-bot`, `shoreline-bot`, `cheezies-bot`, `bibledesk-bot`.
  - Standard bot structure: `bot.json`, `AGENTS.md` (instructions), `SOUL.md` (identity), `MEMORY.md` (context), `workspace/`, and `runs/`.
- **`packages/server/src/bots.ts`** (New File):
  - CRUD operations for bot configurations, markdown directives, workspace file enumeration, and run transcript logging.
- **`packages/server/src/server.ts`**:
  - Implemented `POST /api/bots/:name/run`: spawns a Muse Code session inside the bot's workspace directory, injects `AGENTS.md` as session instructions and `MEMORY.md` as context, records run metadata, and returns session ID.
  - Enforced bot tool allowlists: maps allowed tools to session approval policy (e.g. automatically denying shell commands when shell is not in the bot's tool allowlist).
- **`packages/ui/src/pages/BotsPage.tsx`** (New File):
  - Bots management panel: bot cards, schedule badges, create/edit/delete bot forms, workspace file explorer, and "Run Bot" action.

---

## 4. API Scout Absorption

- **`packages/server/src/scout.ts`** (New File):
  - Reads `bots/api-scout/workspace/catalog/catalog.md`, past reports in `bots/api-scout/workspace/reports/`, and `bots/api-scout/workspace/monitor-log.md`.
- **`packages/server/src/server.ts`**:
  - Implemented `GET /api/scout` and `POST /api/scout/scan` to trigger automated scans without restarting the application.
- **`packages/ui/src/pages/ScoutPage.tsx`** (New File):
  - API Scout panel with tabbed browsing for verified catalog entries, scan reports, live monitor logs, and a "Run Scout Scan" button.

---

## 5. JOSH Approval Policy Hook (Contract Only)

- **`packages/daemon/src/store.ts`**:
  - Extended SQLite settings schema to support `josh_policy_url`.
- **`packages/server/src/server.ts`**:
  - Added `evaluateApprovalPolicy`: when an approval request arrives, queries the JOSH policy endpoint (`/policy`) if configured.
  - Automatically allows or denies based on JOSH decision; fails closed to standard user approval if unconfigured or unreachable.
- **`packages/ui/src/components/settings/SettingsPage.tsx`**:
  - Added configuration field for JOSH Policy Hook URL in the External Integrations section.

---

## 6. ForgeSatchel Control Plane Client (Contract Only)

- **`packages/daemon/src/store.ts`**:
  - Extended SQLite settings schema to support `forge_satchel_url`.
- **`packages/server/src/server.ts`**:
  - Added `registerForgeSatchel`: registers machine with ForgeSatchel on server boot if configured.
  - Never persists or logs secrets. Standalone operation if empty or unreachable.
- **`packages/ui/src/components/settings/SettingsPage.tsx`**:
  - Added configuration field for ForgeSatchel Control Plane URL in the External Integrations section.

---

## 7. Model Context Protocol (MCP) Server

- **`packages/mcp/`** (New Package):
  - Implemented `@helicon/mcp` over stdio transport.
  - Exposes 5 agent tools:
    1. `list_projects`: returns configured projects with paths and categories.
    2. `list_sessions`: returns active and recent threads.
    3. `resume_session`: loads transcript history for a session.
    4. `send_message`: sends a turn or command into a thread.
    5. `read_recent_turns`: reads latest completed turns.
- **`docs/MCP.md`** (New File):
  - Complete documentation and configuration guide for connecting external agents to ShadowHelicon.

---

## 8. Permanent Usage & Rate Meter

- **`packages/ui/src/components/usage/PermanentUsageBar.tsx`** (New File):
  - Fixed in bottom-right corner (`fixed bottom-3 right-3 z-50`).
  - Permanently visible on every view (Threads, Settings, Usage, Labs, Bots, Scout).
  - Displays:
    - 5-hour rolling window percentage and countdown.
    - Weekly cap percentage and reset countdown.
    - Current active thread cost calculated at Meta's published per-token API rates ($/token).
- **`packages/ui/src/app/HeliconApp.tsx`**:
  - Mounted `PermanentUsageBar` inside `Shell` layout.

---

## 9. Sidebar Navigation & Layout Customizations

- **`packages/ui/src/components/sidebar/Sidebar.tsx`**:
  - Rebranded title bar to "ShadowHelicon".
  - Added quick navigation rows for Labs, Bots, and Scout panels.
  - Implemented category grouping for projects from `projects.config.json`.
  - Added private badges (`priv`) for confidential repositories.
- **`packages/ui/src/model/store.ts` & `packages/ui/src/model/controller.ts`**:
  - Extended route model to support `labs`, `bots`, and `scout` hash routes (`#/labs`, `#/bots`, `#/scout`).

---

## 10. Remote Access & Documentation

- **`docs/PHONE-SETUP.md`** (New File):
  - Step-by-step verifiable guide for accessing ShadowHelicon from an iPhone over Tailscale.
  - Zero em dashes, formatted exclusively with PowerShell-compatible commands.
  - Covers setup verification, token generation, firewall ports, and troubleshooting checklist.

---

## 11. Toolchain & Platform Hardening

- **`apps/desktop/scripts/fetch-node.mjs`**:
  - Added mapping for `x86_64-pc-windows-gnu` to `win-x64` node distribution bundle.
- **`packages/daemon/test/wsl.test.ts`**:
  - Added test environment mock (`findNative: () => null`) to prevent host Windows Muse binaries from interfering with WSL test isolation.
- **`packages/server/test/server.test.ts`**:
  - Made file viewer test fixture tolerant of unprivileged Windows symlink creation (EPERM without Developer Mode).
