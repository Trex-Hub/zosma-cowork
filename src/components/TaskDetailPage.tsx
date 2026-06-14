/**
 * TaskDetailPage — the main-pane detail view for a scheduled task (#289, #300).
 *
 * Shows the full task, expose manage actions, and (#300) includes a "Runs"
 * section (expanded by default) with a game-like timeline of past executions.
 */

import { CalendarClock, Pause, Play, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConversationEntry, Task, TaskRun } from "@/types";
import { formatRelative, humanizeCron } from "@/lib/cron";

interface TaskDetailPageProps {
	task: Task | null;
	error?: string | null;
	onRunNow: (id: string) => Promise<void> | void;
	onSetEnabled: (id: string, enabled: boolean) => Promise<void> | void;
	onDelete: (id: string) => Promise<void> | void;
	onClose: () => void;
	listRuns?: (taskId: string, limit?: number) => Promise<TaskRun[]>;
}

export function TaskDetailPage({
	task,
	error,
	onRunNow,
	onSetEnabled,
	onDelete,
	onClose,
	listRuns,
}: TaskDetailPageProps) {
	const [busy, setBusy] = useState<null | "run" | "toggle" | "delete">(null);
	const [runs, setRuns] = useState<TaskRun[]>([]);
	const [runsLoading, setRunsLoading] = useState(false);

	// Fetch runs whenever the task changes (expanded by default)
	useEffect(() => {
		if (!task || !listRuns) return;
		setRunsLoading(true);
		listRuns(task.id, 20)
			.then(setRuns)
			.catch(() => setRuns([]))
			.finally(() => setRunsLoading(false));
	}, [task?.id, listRuns]);

	if (!task) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<CalendarClock className="h-6 w-6" />
				</div>
				<p className="text-sm font-medium text-foreground">Select a task</p>
				<p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
					Pick a scheduled task from the list to see its details, runs, and actions.
				</p>
			</div>
		);
	}

	const run = async () => {
		setBusy("run");
		try {
			await onRunNow(task.id);
		} finally {
			setBusy(null);
		}
	};
	const toggle = async () => {
		setBusy("toggle");
		try {
			await onSetEnabled(task.id, !task.enabled);
		} finally {
			setBusy(null);
		}
	};
	const remove = async () => {
		setBusy("delete");
		try {
			await onDelete(task.id);
			onClose();
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-1 flex-col overflow-y-auto">
			{/* Header */}
			<div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<h1 className="truncate text-lg font-semibold text-foreground">
							{task.name || "Untitled task"}
						</h1>
						<StatusBadge enabled={task.enabled} />
					</div>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{humanizeCron(task.schedule)} · {task.recurring ? "recurring" : "one-shot"}
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close task detail"
					className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{error && (
				<div className="mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			)}

			{/* Actions */}
			<div className="flex flex-wrap gap-2 px-6 py-4">
				<button
					type="button"
					onClick={run}
					disabled={!task.enabled || busy !== null}
					title={task.enabled ? "Run now" : "Enable the task to run it now"}
					className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
				>
					<Play className="h-3.5 w-3.5" />
					Run now
				</button>
				<button
					type="button"
					onClick={toggle}
					disabled={busy !== null}
					className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
				>
					{task.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
					{task.enabled ? "Pause" : "Enable"}
				</button>
				<button
					type="button"
					onClick={remove}
					disabled={busy !== null}
					className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
				>
					<Trash2 className="h-3.5 w-3.5" />
					Delete
				</button>
			</div>

			{/* Prompt */}
			<section className="px-6 py-2">
				<FieldLabel>Prompt</FieldLabel>
				<div className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
					{task.prompt}
				</div>
			</section>

			{/* Metadata grid */}
			<section className="grid grid-cols-1 gap-x-8 gap-y-3 px-6 py-4 sm:grid-cols-2">
				<Field label="Schedule (cron)" value={task.schedule} mono />
				<Field label="Type" value={task.type} />
				<Field label="Next run" value={task.enabled ? formatRelative(task.nextRunAt) : "—"} />
				<Field label="Last run" value={formatRelative(task.lastRunAt)} />
				<Field label="Recurring" value={task.recurring ? "Yes" : "No (one-shot)"} />
				<Field label="Created" value={formatRelative(task.createdAt)} />
			</section>

			{/* Runs section (#300) — expanded by default */}
			{listRuns && (
				<section className="border-t border-border px-6 py-5">
					<div className="flex items-center gap-2 mb-4">
						<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
							Run Log
						</span>
						{runs.length > 0 && (
							<span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-px text-[10px] font-medium text-primary">
								{runs.length}
							</span>
						)}
					</div>

					{runsLoading && (
						<div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
							<div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50" />
							Loading runs…
						</div>
					)}

					{!runsLoading && runs.length === 0 && (
						<div className="rounded-lg border-2 border-dashed border-border bg-muted/20 px-5 py-6 text-center">
							<p className="text-xs font-medium text-muted-foreground">No runs yet</p>
							<p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
								When this task fires, each execution appears here with its prompt and
								response. Click <span className="font-medium text-foreground/80">&ldquo;Run now&rdquo;</span> above to trigger one.
							</p>
						</div>
					)}

					{!runsLoading && runs.length > 0 && (
						<div className="relative space-y-3">
							{/* Timeline line */}
							<div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />

							{runs.map((run, idx) => (
								<RunCard key={run.runId} run={run} isLatest={idx === 0} />
							))}
						</div>
					)}
				</section>
			)}
		</div>
	);
}

function RunCard({ run, isLatest }: { run: TaskRun; isLatest: boolean }) {
	const duration = run.completedAt
		? formatDuration(run.startedAt, run.completedAt)
		: null;

	const statusConfig = {
		pending: { icon: "⏳", label: "Queued", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
		running: { icon: "🔄", label: "Running", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
		completed: { icon: "✓", label: "Success", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
		failed: { icon: "✕", label: "Failed", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
	}[run.status];

	return (
		<div className="relative pl-8">
			{/* Timeline dot */}
			<div
				className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
					isLatest && run.status === "completed"
						? "border-emerald-500/60 bg-emerald-500/15 text-emerald-500 shadow-[0_0_8px_-2px_hsl(160_60%_45%/0.4)]"
						: run.status === "failed"
							? "border-red-500/40 bg-red-500/10 text-red-500"
							: "border-muted-foreground/30 bg-background text-muted-foreground"
				}`}
			>
				{statusConfig.icon}
			</div>

			{/* Card */}
			<div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
				{/* Top row: status badge + timestamp + duration */}
				<div className="flex items-center gap-2 flex-wrap">
					<span className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-semibold ${statusConfig.color}`}>
						{statusConfig.label}
					</span>
					<span className="text-[11px] text-muted-foreground/70">
						{formatRelative(run.startedAt)}
					</span>
					{duration && (
						<>
							<span className="text-[10px] text-muted-foreground/40" aria-hidden>·</span>
							<span className="text-[10px] font-mono text-muted-foreground/50">{duration}</span>
						</>
					)}
					{isLatest && (
						<span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-emerald-500/70">
							Latest
						</span>
					)}
				</div>

				{/* Prompt */}
				<div className="mt-2.5">
					<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
						Instruction
					</p>
					<p className="mt-0.5 line-clamp-2 text-xs text-foreground/85">
						{run.prompt}
					</p>
				</div>

				{/* Conversation tree */}
				{run.conversation && run.conversation.length > 0 && (
					<div className="mt-2 space-y-1">
						<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
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

function ConversationStep({ entry }: { entry: ConversationEntry }) {
	switch (entry.type) {
		case "thinking":
			return (
				<div className="flex items-start gap-1.5 rounded-md bg-amber-500/5 px-2.5 py-1.5">
					<span className="mt-px shrink-0 text-[11px]">💭</span>
					<p className="line-clamp-1 text-[11px] italic text-muted-foreground/60">
						{entry.content?.slice(0, 120)}
					</p>
				</div>
			);
		case "tool_call":
			return (
				<div className="flex items-center gap-1.5 rounded-md bg-sky-500/5 px-2.5 py-1.5">
					<span className="shrink-0 text-[11px]">🔧</span>
					<span className="truncate text-[11px] font-medium text-sky-600 dark:text-sky-400">
						{entry.toolName}
					</span>
					{entry.toolArgs && (
						<span className="truncate text-[10px] text-muted-foreground/50">
							{JSON.stringify(entry.toolArgs).slice(0, 80)}
						</span>
					)}
				</div>
			);
		case "tool_result":
			return (
				<div className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 ${entry.toolError ? "bg-red-500/5" : "bg-emerald-500/5"}`}>
					<span className="mt-px shrink-0 text-[11px]">{entry.toolError ? "⚠️" : "📎"}</span>
					<p className="line-clamp-1 text-[11px] text-muted-foreground/60">
						{entry.toolResult?.slice(0, 100)}
					</p>
				</div>
			);
		case "text":
			return (
				<div className="flex items-start gap-1.5 px-2.5 py-0.5">
					<span className="mt-px shrink-0 text-[11px]">💬</span>
					<p className="line-clamp-2 text-[11px] text-foreground/70">
						{entry.content?.slice(0, 250)}
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

function StatusBadge({ enabled }: { enabled: boolean }) {
	return (
		<span
			className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
				enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
			}`}
		>
			{enabled ? "Active" : "Paused"}
		</span>
	);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</span>
	);
}

function Field({
	label,
	value,
	mono,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0">
			<FieldLabel>{label}</FieldLabel>
			<p className={`mt-0.5 truncate text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>
				{value}
			</p>
		</div>
	);
}
