# Tasks (pi-routines) — scheduling in Zosma Cowork

_Status: spec / draft — 2026-06-14 — tracking issue: [#285](https://github.com/zosmaai/zosma-cowork/issues/285)_

## Decision (locked)

- **Ship `pi-routines` first.** It backs the new **Tasks** tab. `pi-loop`
  (autonomous build) is deferred to a later, separate effort.
- **Information architecture changes:**
  - Rename the **Chats** tab → **Cowork** (the conversational surface).
  - **Replace** the **Templates** tab with a **Tasks** tab (Templates removed).
  - Tasks tab lists scheduled tasks/routines; selecting one opens a **task
    detail page** in the main (right) area. "Workflow" view is a later add —
    for the MVP the detail page just shows task detail.
  - **Tasks are created from chat** in the Cowork tab: the user asks in natural
    language and the agent calls `cron_create` (pi-routines). No separate
    create-form is required for the MVP (a manual "New task" form is a P1+ nicety).

## Summary

Bring Claude Cowork's **Routines**, **Tasks**, and **Loop** to Zosma Cowork by
adopting two existing pi extensions instead of building a scheduler from scratch:

- **[`pi-routines`](https://www.npmjs.com/package/pi-routines)** — a faithful
  port of Claude Code's internal cron scheduler, packaged as a pi extension.
  Provides recurring/one-shot scheduled prompts. Covers **Routines**, **Tasks**,
  and the session **`/loop`** command.
- **[`pi-loop`](https://www.npmjs.com/package/pi-loop)** — a standalone
  planner-worker-judge autonomous coding CLI. Covers the **Loop** (autonomous
  build) experience. Different integration shape (subprocess, not extension).

This is the inverse of how Claude Cowork shipped them as three separate
surfaces; in pi the first three collapse onto one extension.

## Why

Claude Cowork now ships Routines (recurring agent jobs), Tasks (scheduled
one-shots), and Loop (autonomous multi-step build). Cowork has none of these.
The pi ecosystem already has battle-tested equivalents, so the work is
**integration + UI**, not a scheduler from scratch.

## Mapping

| Claude Cowork | pi primitive | Source |
|---|---|---|
| Routine (recurring) | `cron_create` durable, `recurring: true` | pi-routines |
| Task (one-shot scheduled) | `cron_create` durable, `recurring: false` | pi-routines |
| `/loop` (session repeat) | `/loop <interval> <prompt>` command | pi-routines |
| Loop (autonomous build) | planner-worker-judge CLI | pi-loop |

## What `pi-routines` gives us (v0.1.0)

- Tools surfaced to the agent: `cron_create`, `cron_delete`, `cron_list`.
- Command: `/loop <interval> <prompt>` — schedules a recurring **session** task
  and runs it immediately.
- Background scheduler: 1s poll, fires by calling `pi.sendUserMessage(prompt)`.
- Durable tasks persisted to `.pi/scheduled_tasks.json` (survive restart);
  session tasks in-memory.
- Cross-process PID lock (`.pi/scheduled_tasks.lock`) prevents double-fire
  across multiple pi instances.
- chokidar hot-reload of the task file; missed one-shot recovery on startup;
  7-day auto-expiry (configurable); jitter to avoid thundering herd.
- Peer dep declared `@earendil-works/pi-coding-agent >=0.78.0`.

## What `pi-loop` gives us (v0.1.5)

- A CLI (`bin: pi-loop`) — **not** a pi extension (`pi: null` in its
  package.json). Bundles agent prompts (decomposer, coder, judge,
  code-reviewer, review-optimizer).
- Autonomous planner → worker → judge loop for AI-driven development.
- Integration shape: spawn as a subprocess and stream output, similar to how
  the sidecar already drives sessions — **not** loaded via the extension loader.

## UX / IA — the Tasks tab

Current shell (verified):
- `src/components/Sidebar.tsx` — left glass panel with a 2-tab pill switcher
  `TABS = [chats, templates]` + a Settings footer. `activeTab` derives from the
  `view` string.
- `src/components/MobileBottomNav.tsx` — mirrors the same tabs (Chats /
  Templates / Settings) for mobile.
- `src/App.tsx` — `sidebarView` state (`"chats" | "templates" | "settings"`),
  `onChangeView` switches it; the main content area renders the chat thread.
- `src/components/PromptTemplates.tsx` + `src/data/templates.ts` — the
  Templates panel being removed.

Target shell:
- **Tab labels:** `chats` tab relabel **"Chats" → "Cowork"** (icon
  `MessageSquare`); replace `templates` tab with **"Tasks"** (id `tasks`, icon
  e.g. `ListChecks`/`CalendarClock`). Update both `Sidebar.tsx` `TABS` and
  `MobileBottomNav.tsx`.
- **View state:** widen `sidebarView` to `"chats" | "tasks" | "settings"`;
  remove the `templates` branch and `onUseTemplate` plumbing. Delete
  `PromptTemplates*` and `data/templates.ts` (and their tests).
- **Tasks panel (left):** new `TasksList` component in the sidebar content area
  (replacing the `PromptTemplates` slot) — lists tasks from
  `cron_list` / the sidecar bridge with name, schedule (human-readable), next
  run, and recurring/one-shot + enabled state. Click selects a task.
- **Task detail (right / main):** selecting a task swaps the main content area
  from the chat thread to a **Task Detail** page showing: name, prompt,
  cron expression + human-readable schedule, type (durable/session),
  recurring, next run, last run, status, and actions (run-now, pause/enable,
  delete). "Workflow" visualization is a later iteration — MVP = detail only.
- **Create from chat:** no dedicated form for MVP. In the Cowork tab the user
  says e.g. “every weekday at 9am summarize my unread email”; the agent calls
  `cron_create`. After creation, surface a confirmation chip and the new task
  appears in the Tasks tab.

### Sidecar bridge for the UI

The Tasks UI must read/write tasks without going through the LLM. Add sidecar
commands (cf. `command-queue.ts` / `remote-server.ts` patterns, e.g.
`list_extensions`) that proxy pi-routines’ task store:
- `tasks_list` → read `.pi/scheduled_tasks.json` (+ in-memory session tasks).
- `tasks_delete` / `tasks_set_enabled` / `tasks_run_now`.
- A push event when the store changes (pi-routines already watches the file via
  chokidar) so the Tasks list live-updates.
Decide whether these call the extension’s tools directly or read the JSON file
(per-cwd). The file is the simplest source of truth for the list view.

## Integration mechanics (Cowork sidecar)

Verified against the bundled pi in `agent-sidecar`:

1. **Extension loading already exists.** `disk-extension-loader.ts` loads pi's
   disk/npm/git extensions via virtualModules-backed jiti from
   `~/.pi/agent/settings.json` `packages` + `~/.pi/agent/extensions`.
   `extension-manager.ts` can install npm packages from the UI. So
   `pi-routines` can be installed/enabled through the existing path.
2. **The firing API exists.** `pi-routines` fires via
   `pi.sendUserMessage()`. The bundled pi is **0.74.2**; its `ExtensionAPI`
   already exposes `sendUserMessage`, `registerTool`, `registerCommand`, and
   the `session_start`/`session_shutdown` lifecycle events the extension needs
   (`agent-sidecar/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`).
   The runner binds `runtime.sendUserMessage = actions.sendUserMessage` in
   `bindCore`.

## Open questions / risks

1. **Always-on vs desktop lifecycle (the big one).** `pi-routines` only fires
   while a pi session is live. Cowork is a desktop app — close the window and
   routines stop. "Run while I'm away" requires the sidecar to run as a
   **background daemon** independent of any open window. Decide:
   - (a) routines only fire while Cowork is open (MVP, honest), or
   - (b) a headless sidecar daemon + OS autostart + notifications (full).
2. **Version skew.** ~~pi-routines peer `>=0.78.0`; sidecar bundles `0.74.2`.~~
   **RESOLVED by #286** — runs on 0.74.2 with 0 load errors, no newer API
   referenced, no pi bump needed. Install needs `--legacy-peer-deps` (or the
   extension-manager npm-pack path). See "P0 spike outcome".
3. **sendUserMessage → UI surfacing.** **RESOLVED by #286** — routes through the
   same `session.prompt()`/`session.subscribe()` path the sidecar already
   forwards to the UI; fired prompt renders as a `role:"user"` bubble and the
   agent replies, including when idle. See "P0 spike outcome".
4. **Which session?** Routines fire into "the" session. Cowork is multi-session
   / multi-window. Decide whether a routine binds to a specific chat/project
   cwd (the lock + `.pi/scheduled_tasks.json` are per-cwd) or a global one.
5. **UI surface.** None exists. Need a Routines/Tasks manager (Settings tab or
   dedicated view) to create/list/delete/pause — not just agent-driven tools.
6. **Fork our own vs depend on npm.** pi-routines is third-party (`offbynan`).
   Decide vendor-fork (like office-docs/google) vs npm dependency, given we may
   need UI hooks, per-session binding, and notification surfacing it lacks.
7. **pi-loop packaging.** CLI must ship inside the Tauri bundle (node binary /
   sidecar binaries, cf. #128) and be spawned + streamed; design its UI as a
   distinct "Loop / autonomous build" mode, separate from Routines.

## P0 spike outcome (#286)

_Verdict: **PASS** — a durable `* * * * *` task fires into a live pi 0.74.2
session via `pi.sendUserMessage()`, surfaces on the `session.subscribe()` event
stream as a `role:"user"` message (the exact event the sidecar forwards to the
desktop UI), and the agent runs a full turn and responds. Spiked 2026-06-14 on
branch `spike/286-pi-routines`._

### How it was proven

A headless harness (`agent-sidecar/spike286-harness.ts`, throwaway) mirrors the
sidecar init exactly — `AuthStorage` → `ModelRegistry` →
`SettingsManager.inMemory` + `setPackages(readPiPackages())` →
`DefaultResourceLoader({ noExtensions:true, extensionFactories:[pi-routines] })`
→ `createAgentSession` → `session.subscribe(...)` → `session.bindExtensions(...)`.
It then writes a durable task to `<cwd>/.pi/scheduled_tasks.json` with
`nextRunAt` 5s in the past so the scheduler's 1s poll fires it immediately (no
minute-boundary wait). Observed event sequence on the subscribe stream:

```
[pi-routines] Acquired scheduler lock
[pi-routines] Firing task: spike
message_start  { role:"user", content:[{text:"[Scheduled task fired: spike]\n\nsay SPIKE OK <ISO>"}] }
agent_start -> turn_start -> message_start -> message_update -> turn_end -> agent_end
assistant message_end -> "SPIKE OK <ISO>"
```

### Risk #2 verdict — version skew: RESOLVED (no pi bump needed for P0/P1)

- pi-routines loaded under the bundled **0.74.2** with **0 load errors** and
  fired successfully. Its entire runtime API surface — `pi.on(session_start/
  session_shutdown)`, `pi.registerTool`, `pi.registerCommand`,
  `pi.sendUserMessage`, `ctx.cwd`, `ctx.ui.notify` — is present in 0.74.2
  (verified in `dist/core/extensions/types.d.ts`: `ExtensionAPI` +
  `ExtensionContext` + `ExtensionUIContext`). Nothing newer is referenced.
- The declared peer `>=0.78.0` is **declarative/optional**
  (`peerDependenciesMeta.optional: true`); it is not enforced at runtime.
- **Install-time caveat:** a direct `npm install pi-routines` into a tree that
  pins pi `0.74.2` throws `ERESOLVE` on that peer range — install with
  `--legacy-peer-deps`. Cowork's own `extension-manager.ts` **sidesteps this
  entirely**: it installs via `npm pack` + tar-extract (no dependency
  resolution against the host tree), then `npm install --production` inside the
  isolated package dir — so the UI install path is clean.

### Risk #3 verdict — sendUserMessage -> UI surfacing: RESOLVED

- `pi.sendUserMessage()` -> `session.sendUserMessage()` ->
  `session.prompt(text, { source:"extension" })` — the **same** `prompt()` path
  the sidecar uses for normal user input (`activeSession.prompt(cmd.text)`).
  Its events therefore flow through the identical `session.subscribe(...)`
  forwarder the sidecar already wires to the desktop UI/event-bus.
- The fired prompt appears as a `message_start` with `role:"user"` — it renders
  as a normal **user bubble** in the Cowork chat, then the agent replies.
- **Idle case confirmed:** the fire was delivered while no turn was in flight;
  `sendUserMessage` "always triggers a turn," so it spun up a fresh
  `agent_start`/`turn_start` and completed. No open turn is required.

### Other findings / gotchas surfaced

- **Install location matters for `npm:` resolution.** The sidecar resolves
  `npm:` packages from settings via pi's `DefaultPackageManager`, whose
  user-scope install path is `npm root -g` (the global node_modules — here the
  mise global). The other 12 extensions live there. To make the sidecar pick
  up `npm:pi-routines`, it must be in that global root (e.g. `npm install -g
  pi-routines`) **or** installed via `extension-manager.ts` (npm-pack drop-in
  under `~/.pi/agent/extensions`). Adding `npm:pi-routines` to
  `~/.pi/agent/settings.json` `packages` is necessary but **not sufficient** if
  the package isn't physically in the resolver's root. (`~/.pi/agent/npm/` is a
  separate store and is **not** where user-scope `npm:` resolution looks.)
- **`.pi/scheduled_tasks.json` is a clean read/write SoT** for durable tasks —
  the sidecar Tasks bridge (#288) can list/delete/toggle durable tasks by
  editing this file directly (we wrote it by hand and the chokidar watcher +
  poll honoured it). **Session** tasks are in-memory only and are **not**
  visible to a file-based bridge.
- **Lock is per-cwd** (`.pi/scheduled_tasks.lock`, PID-based). The spike used a
  dedicated stable cwd. Multi-window/multi-session (#288 risk #4) still needs a
  per-session-vs-global binding decision.

### Vendor-fork vs npm dependency — verdict

**Start as a pinned npm dependency (`pi-routines@0.1.0`); fork later only if
#288/#289 need host-facing hooks it lacks.** It runs unmodified on 0.74.2 and
the durable-task file is a sufficient SoT for the Tasks list MVP. A vendor-fork
becomes warranted when we need: a programmatic host API to enumerate/pause/
run-now (it exposes only agent tools today), change events richer than
chokidar-on-file, per-session binding, or native-notification surfacing — none
of which 0.1.0 provides. No pi version bump is required for P0/P1.

## Proposed phasing

- **P0 — Spike (S) — #286:** ✅ **DONE** — durable `* * * * *` task fires
  `sendUserMessage` into a live session and renders as a user bubble; agent
  responds. Resolved risks #2 and #3. See "P0 spike outcome" above.
- **P1 — IA rename (S) — #287:** “Chats” → “Cowork”, remove Templates tab +
  delete `PromptTemplates`/`data/templates.ts`, add empty **Tasks** tab
  scaffold. Update `Sidebar.tsx`, `MobileBottomNav.tsx`, `App.tsx` view state
  + tests.
- **P2 — Tasks bridge (M) — #288:** sidecar
  `tasks_list/delete/set_enabled/run_now` commands + change push event over the
  existing event-bus.
- **P3 — Tasks UI (M) — #289:** `TasksList` (left) + **Task Detail** page
  (right), fires only while Cowork is open. Create-from-chat confirmation chip.
- **P4 — Always-on daemon (L) — #290:** headless sidecar daemon + autostart +
  native notifications so tasks fire while Cowork is closed. Resolves risk #1.
- **Later — `/loop` command (S) — #291:** surface `/loop` in the composer
  (depends on slash-command epic #179/#183).
- **Later — pi-loop autonomous mode (L) — #292:** bundle + spawn pi-loop CLI as
  a distinct autonomous-build mode; possible “Workflow” view on the task detail
  page.

## References

- pi-routines: https://www.npmjs.com/package/pi-routines · https://github.com/offbynan/pi-routines
- pi-loop: https://www.npmjs.com/package/pi-loop
- Related: slash-command epic #179 / #183, steering #201, sidecar bundling #128
