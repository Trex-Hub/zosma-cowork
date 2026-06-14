/**
 * RunHistory — full-screen run history feed for the Tasks tab home (#300).
 *
 * Shows every recorded run across ALL tasks in a vertical timeline, grouped
 * by date. Acts as the default view when no task is selected.
 */

import { History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Task, TaskRun } from "@/types";
import { formatRelative } from "@/lib/cron";

interface RunEntry {
	run: TaskRun;
	taskName: string;
}

interface DateGroup {
	label: string;
	entries: RunEntry[];
}

interface RunHistoryProps {
	tasks: Task[];
	completedTasks: { taskId: string; name: string; lastRun: TaskRun }[];
	completedLoading: boolean;
	listRuns: (taskId: string, limit?: number) => Promise<TaskRun[]>;
	onJumpToTask?: (taskId: string) => void;
}

export function RunHistory({
	tasks,
	completedTasks,
	completedLoading: _completedLoading,
	listRuns,
	onJumpToTask,
}: RunHistoryProps) {
	const [entries, setEntries] = useState<RunEntry[]>([]);
	const [loading, setLoading] = useState(true);

	const loadAllRuns = useCallback(async () => {
		setLoading(true);
		const all: RunEntry[] = [];

		// Collect runs from active tasks
		for (const task of tasks) {
			try {
				const runs = await listRuns(task.id, 5);
				for (const run of runs) {
					all.push({ run, taskName: task.name || "Untitled task" });
				}
			} catch {
				// skip
			}
		}

		// Collect runs from completed tasks
		for (const ct of completedTasks) {
			if (!tasks.some((t) => t.id === ct.taskId)) {
				all.push({ run: ct.lastRun, taskName: ct.name || "Completed task" });
			}
		}

		all.sort((a, b) => new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime());
		setEntries(all);
		setLoading(false);
	}, [tasks, completedTasks, listRuns]);

	useEffect(() => {
		loadAllRuns();
	}, [loadAllRuns]);

	// Group entries by date
	const groups = groupByDate(entries);

	if (loading && entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50" />
			</div>
		);
	}

	if (entries.length === 0) {
		return <RunHistoryEmpty />;
	}

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			{/* Sticky header */}
			<div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
				<div className="flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<History className="h-4 w-4" />
					</div>
					<div>
						<h1 className="text-sm font-semibold text-foreground">Activity</h1>
						<p className="text-[11px] text-muted-foreground/60">
							{entries.length} run{entries.length !== 1 ? "s" : ""} across all tasks
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={loadAllRuns}
					disabled={loading}
					className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-accent disabled:opacity-40"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
					Refresh
				</button>
			</div>

			{/* Timeline */}
			<div className="flex-1 px-6 py-5">
				<div className="relative mx-auto max-w-2xl">
					{/* Vertical timeline line */}
					<div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />

					{groups.map((group) => (
						<div key={group.label} className="mb-6 last:mb-0">
							{/* Date header */}
							<div className="sticky top-0 z-10 -mx-6 mb-3 bg-background/90 px-6 py-2 backdrop-blur-sm">
								<span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
									{group.label}
								</span>
							</div>

							{/* Entries for this date */}
							<div className="space-y-3">
								{group.entries.map((entry) => (
									<RunCard
										key={entry.run.runId}
										entry={entry}
										onJumpToTask={onJumpToTask}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function RunCard({
	entry,
	onJumpToTask,
}: {
	entry: RunEntry;
	onJumpToTask?: (taskId: string) => void;
}) {
	const { run, taskName } = entry;
	const duration = run.completedAt
		? formatDuration(run.startedAt, run.completedAt)
		: null;

	const statusConfig = {
		pending: { icon: "⏳", label: "Queued", ring: "border-amber-500/30" },
		running: { icon: "🔄", label: "Running", ring: "border-sky-500/30" },
		completed: { icon: "✓", label: "Success", ring: "border-emerald-500/40" },
		failed: { icon: "✕", label: "Failed", ring: "border-red-500/30" },
	}[run.status];

	return (
		<div className="relative pl-10">
			{/* Timeline dot */}
			<div
				className={`absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm ${
					run.status === "completed"
						? "border-emerald-500/50 bg-emerald-500/15 text-emerald-500"
						: run.status === "failed"
							? "border-red-500/40 bg-red-500/10 text-red-500"
							: "border-muted-foreground/30 bg-background text-muted-foreground"
				}`}
			>
				{statusConfig.icon}
			</div>

			{/* Card */}
			<div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
				{/* Top row */}
				<div className="flex items-center gap-2 flex-wrap">
					{/* Task name */}
					<span className="text-xs font-semibold text-foreground">{taskName}</span>

					{/* Status badge */}
					<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[9px] font-semibold ${run.status === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : run.status === "failed" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" : "bg-muted text-muted-foreground border-border"}`}>
						{statusConfig.label}
					</span>

					{/* Timestamp */}
					<span className="text-[10px] text-muted-foreground/60">
						{formatRelative(run.startedAt)}
					</span>

					{/* Duration */}
					{duration && (
						<span className="text-[10px] font-mono text-muted-foreground/40">
							{duration}
						</span>
					)}

					{/* Jump to task */}
					{onJumpToTask && (
						<button
							type="button"
							onClick={() => onJumpToTask(run.taskId)}
							className="ml-auto shrink-0 rounded-md px-2 py-0.5 text-[9px] font-medium text-muted-foreground/50 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
						>
							View task →
						</button>
					)}
				</div>

				{/* Prompt */}
				<div className="mt-2">
					<p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
						Instruction
					</p>
					<p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">
						{run.prompt}
					</p>
				</div>

				{/* Response */}
				{/* Conversation tree */}
				{run.conversation && run.conversation.length > 0 && (
					<div className="mt-2 space-y-1">
						<p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
							Steps
						</p>
						{run.conversation.map((entry, i) => (
							<ConversationStep key={i} entry={entry} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function RunHistoryEmpty() {
	return (
		<div className="flex h-full flex-col items-center justify-center px-6 text-center">
			<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<History className="h-6 w-6" />
			</div>
			<h2 className="text-base font-semibold text-foreground">No activity yet</h2>
			<p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
				When a scheduled task fires, each execution appears in a timeline here — along with
				the instruction the AI received and the result it produced.
			</p>
			<p className="mt-4 text-xs text-muted-foreground/60">
				Try clicking <span className="font-medium text-foreground/80">&ldquo;Run now&rdquo;</span> on any task to create the first entry.
			</p>
		</div>
	);
}

function ConversationStep({ entry }: { entry: { type: string; content?: string; toolName?: string; toolArgs?: Record<string, unknown>; toolResult?: string; toolError?: boolean } | import("@/types").ConversationEntry }) {
	switch (entry.type) {
		case "thinking":
			return (
				<div className="flex items-start gap-1.5 rounded-md bg-amber-500/5 px-2 py-1">
					<span className="mt-px shrink-0 text-[10px]">💭</span>
					<p className="line-clamp-1 text-[10px] italic text-muted-foreground/60">
						{entry.content?.slice(0, 120)}
					</p>
				</div>
			);
		case "tool_call":
			return (
				<div className="flex items-center gap-1.5 rounded-md bg-sky-500/5 px-2 py-1">
					<span className="shrink-0 text-[10px]">🔧</span>
					<span className="truncate text-[10px] font-medium text-sky-600 dark:text-sky-400">
						{entry.toolName}
					</span>
					{entry.toolArgs && (
						<span className="truncate text-[9px] text-muted-foreground/50">
							{JSON.stringify(entry.toolArgs).slice(0, 80)}
						</span>
					)}
				</div>
			);
		case "tool_result":
			return (
				<div className={`flex items-start gap-1.5 rounded-md px-2 py-1 ${entry.toolError ? "bg-red-500/5" : "bg-emerald-500/5"}`}>
					<span className="mt-px shrink-0 text-[10px]">{entry.toolError ? "⚠️" : "📎"}</span>
					<p className="line-clamp-1 text-[10px] text-muted-foreground/60">
						{entry.toolResult?.slice(0, 100)}
					</p>
				</div>
			);
		case "text":
			return (
				<div className="flex items-start gap-1.5 px-2 py-0.5">
					<span className="mt-px shrink-0 text-[10px]">💬</span>
					<p className="line-clamp-2 text-[10px] text-foreground/70">
						{entry.content?.slice(0, 200)}
					</p>
				</div>
			);
		default:
			return null;
	}
}

function formatDuration(start: string, end: string): string {
	const ms = new Date(end).getTime() - new Date(start).getTime();
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${Math.round(ms / 1000)}s`;
	const m = Math.floor(ms / 60000);
	const s = Math.round((ms % 60000) / 1000);
	return `${m}m ${s}s`;
}

function groupByDate(entries: RunEntry[]): DateGroup[] {
	const groups: { label: string; entries: RunEntry[] }[] = [];
	const now = new Date();
	const today = now.toDateString();
	const yesterday = new Date(now.getTime() - 86400000).toDateString();

	let currentLabel = "";
	let currentGroup: RunEntry[] = [];

	for (const entry of entries) {
		const d = new Date(entry.run.startedAt);
		let label: string;
		if (d.toDateString() === today) {
			label = "Today";
		} else if (d.toDateString() === yesterday) {
			label = "Yesterday";
		} else if (now.getTime() - d.getTime() < 7 * 86400000) {
			label = "This Week";
		} else {
			label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
		}

		if (label !== currentLabel) {
			if (currentGroup.length > 0) {
				groups.push({ label: currentLabel, entries: currentGroup });
			}
			currentLabel = label;
			currentGroup = [];
		}
		currentGroup.push(entry);
	}
	if (currentGroup.length > 0) {
		groups.push({ label: currentLabel, entries: currentGroup });
	}
	return groups;
}
