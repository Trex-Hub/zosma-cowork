# Handoff: #300 Task Execution Routing — fire within Cowork + Run History UI

## Current State

The `feat/300-task-execution` branch has ~782 lines of changes across 10 files.
PR is stacked on `feat/289-tasks-ui` (PR #299), which is stacked on #294, #295, #298.

**Typecheck:** ✅ clean
**Tests:** 486/486 ✅
**Lint:** ✅ clean
**Prebuild:** ✅ sidecar bundle builds (11.5 MB)

## What Works

- **Tasks UI**: sidebar task list, detail page, pause/enable, delete, run-now
- **Run History**: global "Activity" feed showing all runs across all tasks, grouped by date
- **Conversation tree**: per-run display of thinking blocks, tool calls, tool results, text responses
- **Shared task file** (`.pi/scheduled_tasks.json`): pi CLI and Cowork GUI use the same file
- **Run recording**: fork records runs as `.pi/task_runs/<taskId>.jsonl`
- **Runs section in TaskDetailPage**: expanded by default, timeline design
- **Stuttering text fix**: error messages now forward `ame.message` instead of just "Error"
- **Model restore on session load**: fixed `handleSessionSelect` to restore `activeModelId`

## What's Broken / Needs Work

### 1. Task fires into pi CLI, not Cowork (CRITICAL)
**Root cause**: Both pi CLI and Cowork run the forked pi-routines. Both have schedulers that poll the same task file. The pi CLI's scheduler fires into the terminal via `sendUserMessage` instead of Cowork's `__PI_ROUTINES_ON_FIRE` callback.

**Current approach**: Separate lock files (`.pi/scheduled_tasks.lock` for pi CLI, `.pi/cowork_tasks.lock` for Cowork). Both can fire independently.

**Fix attempted**: Fork's `onFire` checks for Cowork's lock file and defers. But this needs the pi CLI to reload the fork after the fix.

**Better fix needed**: The architecture should be:
- The pi CLI loads the fork as an extension BUT skips creating a scheduler when Cowork is active
- Only Cowork's scheduler fires tasks
- This needs a **cross-process signal** (flag file, socket, env var) that Cowork sets

**Simplest immediate fix**: 
- Kill the pi CLI process when running Cowork
- Or: have Cowork's `initAgent` write a flag file that the pi CLI's fork checks

### 2. "Run now" delayed by jitter (FIXED but untested)
**Root cause**: pi-routines adds up to 15 min of forward jitter to recurring task fire times. "Run now" set `nextRunAt` to 5s in the past, so the jitter pushed actual fire to ~10 min later.

**Fix**: `runTaskNow` now sets `nextRunAt` to 16 min in the past to overcome jitter.

### 3. Forked pi-routines key architecture

The fork at `zosmaai/pi-routines` (in `~/code/pi-packages/pi-routines`) has:

```
~/code/pi-packages/pi-routines/
├── src/
│   ├── index.ts          ← extension entry, checks __PI_ROUTINES_ON_FIRE global
│   ├── cronScheduler.ts   ← accepts onFireCallback, lockFilePath, records runs
│   ├── cronTasks.ts       ← accepts tasksFilePath, records runs (jsonl)
│   └── cronTasksLock.ts   ← accepts lockFilePath
└── package.json
```

Settings.json loads it via: `../../code/pi-packages/pi-routines`

**Important**: The pi CLI also loads this fork (same settings.json). Both processes use the same fork code.

### 4. All the files at `.pi/`

| File | Purpose | Written by |
|------|---------|------------|
| `.pi/scheduled_tasks.json` | Task list (shared) | pi CLI + Cowork |
| `.pi/scheduled_tasks.lock` | pi CLI's scheduler lock | pi CLI |
| `.pi/cowork_tasks.lock` | Cowork's scheduler lock | Cowork |
| `.pi/scheduled_tasks_disabled.json` | Paused tasks | Cowork bridge |
| `.pi/task_runs/<taskId>.jsonl` | Run history | Fork (any process) |

### 5. The double-task bug
The "Market Research (5min)" task appeared in both active and disabled files (from earlier file merges). Fixed by removing from disabled.

## Key Files Changed

| File | Changes |
|------|---------|
| `agent-sidecar/src/index.ts` | `__PI_ROUTINES_ON_FIRE` callback (captures full conversation tree), `__PI_ROUTINES_LOCK_FILE` global |
| `agent-sidecar/src/tasks-store.ts` | Uses `.pi/scheduled_tasks.json` (shared); `listRuns()`, `getCompletedTasks()`; `runTaskNow` jitter fix |
| `src-tauri/src/lib.rs` | `tasks_list_runs`, `tasks_get_completed` Rust shims; `task_run_completed` event |
| `src/App.tsx` | RunHistory as Tasks home; model restore on session load; routines activates for history |
| `src/components/Sidebar.tsx` | completedTasks + completedTasksLoading props |
| `src/components/TaskDetailPage.tsx` | Run Log (expanded by default, timeline, conversation tree) |
| `src/components/TasksList.tsx` | Completed section |
| `src/components/RunHistory.tsx` | NEW — global activity feed with date grouping |
| `src/hooks/usePiStream.ts` | Forward `ame.message` on error instead of "Error" |
| `src/hooks/useTasks.ts` | `listRuns()`, `getCompletedTasks()`, `task_run_completed` listener |
| `src/types/index.ts` | `TaskRun`, `ConversationEntry`, `CompletedTask` types |

## PR Status

```bash
# Branch
git worktree add .worktrees/300-task-execution -b feat/300-task-execution feat/289-tasks-ui
cd .worktrees/300-task-execution

# Push to arjun-fork
git push -u arjun-fork feat/300-task-execution

# Create PR against zosmaai/zosma-cowork main
gh pr create --repo zosmaai/zosma-cowork --base main \
  --head arjun-zosma:feat/300-task-execution \
  --title "feat(#300): task execution routing — fire within Cowork + run-history UI" \
  --body "## Summary

- Forked pi-routines to zosmaai/pi-routines with run recording, onFireCallback, custom file/lock path
- Tasks in Cowork GUI share same task file as pi CLI
- Run history stored as .pi/task_runs/<taskId>.jsonl with full conversation tree
- New Activity feed showing all runs chronologically

## Changes

- 782 lines across 10 files
- Fork: github.com/zosmaai/pi-routines (4 commits on main)

## Open Issues

- Task fire routing: pi CLI scheduler fires into terminal instead of Cowork when both are running
- Need cross-process signal for pi CLI to defer when Cowork is active"
```

## To Continue in Fresh Session

```bash
cd /home/arjun/code/zosmaai/zosma-cowork
git fetch arjun-fork
git worktree add .worktrees/300-task-execution -b feat/300-task-execution feat/289-tasks-ui
cd .worktrees/300-task-execution
npm install
node scripts/prebuild.mjs
npm run tauri dev
```
