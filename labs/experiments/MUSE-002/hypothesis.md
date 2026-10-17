# MUSE-002 hypothesis

A version-1 read adapter can list/read synthetic domain documents only with server-owned read permission, denying unsupported mutations and malformed requests before callbacks.

Falsified locally by any incorrect response, permission bypass or denied-operation callback in deterministic tests. Scope is local simulation only.
