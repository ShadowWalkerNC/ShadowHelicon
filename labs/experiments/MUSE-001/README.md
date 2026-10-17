# MUSE-001 local harness

Use the existing Node 24 runtime. No dependencies are installed. Strict typechecking uses the existing BibleDesk TypeScript compiler, configurable with `MUSE001_TSC`; native TypeScript stripping is only runtime loading.

```powershell
node harness.mjs selftest
node harness.mjs prepare-run slicer
node harness.mjs prepare-run backoff
node harness.mjs prepare-run events
node harness.mjs verify-run '<run-directory printed by prepare-run>'
```

Preparation creates a fresh `runs/<task>-<random>/scratch` with source and a package manifest. The separate `control` directory holds the baseline hashes, prompt, verifier tests, strict compiler logs and result. Give the agent only the printed scratch workspace and prompt. Run it using existing CLI defaults and bounded steps/time; do not grant access to control or this harness. Reference implementations and acceptance checks live in this harness outside scratch. There is no Git commit; `fixtureHash` is a SHA-256 content-inventory digest.

Slicer strengthened baseline fails exactly three of six cases; backoff baseline fails seven of seven; events baseline fails two of six. Reference implementations pass runtime and strict compiler checks. Events also reject `any`, assertion casts and suppression directives and compile a copied source against an additional event variant, which must produce a `never` assignment error. This intentionally restricts accepted implementations; it is not a general TypeScript lint engine.

Backoff follows `min(maxMs,baseMs*2**attempt)*(1+jitterRatio)`: the cap applies **before** jitter, so output may exceed maxMs. All four inputs must be finite; attempt is a nonnegative integer; base/max are nonnegative; jitter is in [0,1]. Invalid values throw RangeError.

After execution, verification compares every scratch file hash and rejects additions/deletions or changes outside declared source files. Acceptance tests remain outside scratch. Selftest demonstrates references and extra-file tamper rejection; it does not demonstrate Muse coding capability. Agent latency, steps, retries and cost remain unknown until independently recorded by the executor. A verification PASS alone does not establish the benchmark's timing, step or repeatability criteria.

The harness does not enforce network isolation, monitor paths outside scratch, or sandbox arbitrary generated code. The Muse provider needs connectivity; retain actual CLI sandbox defaults and disable unnecessary tools. Hash checks are observations, not a substitute for permissions. Preserve raw artifacts and do not call unknown measurements zero. The parent executor owns actual run metrics, decisions, root documentation and ledger updates.

Boundary follow-up: selftest now checks added, modified and deleted protected files; each rejection records checksExecuted=false before runtime/compiler checks. Symlink inventory throws before execution. These checks do not certify arbitrary generated-code isolation.


Runtime checks use Node --permission, scratch/control read allowances, no write/child-process grant and reduced environment. This is a resource guard for local trusted fixtures, not a hostile-code sandbox; Node24 network isolation is not claimed. Source-only review open issues are tracked centrally in P04_REVIEW_DISPOSITION.md.

Event verification uses the existing TypeScript Compiler API: AST checks reject actual any types, casts and suppression comments, while allowing harmless prose, import aliases, formatting and assertNever helpers. The canonical union must retain all three required string-bearing variants. A copied AST-position expansion adds an unexpected variant and must cause a genuine never-related compiler diagnostic. Selftests exercise valid reformatted/aliased code and reject any, casts, suppressions, missing exhaustiveness and removed variants.

Numeric-domain refinement: mathematical exponential growth is capped before jitter; zero base/cap returns zero even for huge attempts, positive overflow caps safely, and nonfinite final jitter output throws RangeError. This prevents JavaScript zero-times-Infinity NaN from satisfying a finite capped utility contract.

Public verify-run withholds all runtime/compiler checks and records NOT RUN unless authored internal selftest fixtures are being checked. There is no public trust-bypass flag. node --test harness-safety.test.mjs confirms edited source is not executed. This guard leaves full generated-code acceptance pending; do not count it as a benchmark PASS.
