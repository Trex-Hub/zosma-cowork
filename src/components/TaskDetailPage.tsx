/**
 * TaskDetailPage — the main-pane detail view for a scheduled task (#289).
 *
 * Renders in the main content area (mirrors how `SettingsPage` takes over the
 * pane) when a task is selected in the sidebar `TasksList`. Shows the full task
 * and exposes the manage actions backed by the #288 sidecar bridge:
 *   - Run now   → fires on pi-routines' next 1s poll (sets nextRunAt to the past)
 *   - Pause/Enable → moves the task in/out of the bridge's disabled file
 *   - Delete    → removes it from the store
 *
 * Creation isn't here: tasks are scheduled by the agent via `cron_create` from a
 * Cowork chat. When no task is selected we show a lightweight hint.
 */

import { CalendarClock, Pause, Play, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/types";
import { formatRelative, humanizeCron } from "@/lib/cron";

interface TaskDetailPageProps {
	task: Task | null;
	error?: string | null;
	onRunNow: (id: string) => Promise<void> | void;
	onSetEnabled: (id: string, enabled: boolean) => Promise<void> | void;
	onDelete: (id: string) => Promise<void> | void;
	onClose: () => void;
}

export function TaskDetailPage({
	task,
	error,
	onRunNow,
	onSetEnabled,
	onDelete,
	onClose,
}: TaskDetailPageProps) {
	const [busy, setBusy] = useState<null | "run" | "toggle" | "delete">(null);

	if (!task) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
				<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<CalendarClock className="h-6 w-6" />
				</div>
				<p className="text-sm font-medium text-foreground">Select a task</p>
				<p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
					Pick a scheduled task from the list to see its details and actions, or ask in a Cowork
					chat to schedule a new one.
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
				<FieldLabel>Prompt sent when it fires</FieldLabel>
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
		</div>
	);
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
