import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/types";
import { TaskDetailPage } from "./TaskDetailPage";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task_1",
		name: "Morning email",
		schedule: "0 9 * * *",
		prompt: "summarize my unread email",
		type: "durable",
		createdAt: "2026-06-14T00:00:00.000Z",
		recurring: true,
		maxAgeDays: 7,
		enabled: true,
		...overrides,
	};
}

const handlers = () => ({
	onRunNow: vi.fn(),
	onSetEnabled: vi.fn(),
	onDelete: vi.fn(),
	onClose: vi.fn(),
});

describe("TaskDetailPage", () => {
	it("shows a hint when no task is selected", () => {
		render(<TaskDetailPage task={null} {...handlers()} />);
		expect(screen.getByText("Select a task")).toBeInTheDocument();
	});

	it("renders the task name, humanized schedule and prompt", () => {
		render(<TaskDetailPage task={task()} {...handlers()} />);
		expect(screen.getByText("Morning email")).toBeInTheDocument();
		expect(screen.getByText(/Every day at 9:00 AM/)).toBeInTheDocument();
		expect(screen.getByText("summarize my unread email")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
	});

	it("run-now calls onRunNow with the task id", () => {
		const h = handlers();
		render(<TaskDetailPage task={task()} {...h} />);
		fireEvent.click(screen.getByText("Run now"));
		expect(h.onRunNow).toHaveBeenCalledWith("task_1");
	});

	it("pause calls onSetEnabled(false) for an enabled task", () => {
		const h = handlers();
		render(<TaskDetailPage task={task({ enabled: true })} {...h} />);
		fireEvent.click(screen.getByText("Pause"));
		expect(h.onSetEnabled).toHaveBeenCalledWith("task_1", false);
	});

	it("a paused task shows Enable and disables Run now", () => {
		const h = handlers();
		render(<TaskDetailPage task={task({ enabled: false })} {...h} />);
		expect(screen.getByText("Paused")).toBeInTheDocument();
		const runBtn = screen.getByText("Run now").closest("button");
		expect(runBtn).toBeDisabled();
		fireEvent.click(screen.getByText("Enable"));
		expect(h.onSetEnabled).toHaveBeenCalledWith("task_1", true);
	});

	it("delete calls onDelete", () => {
		const h = handlers();
		render(<TaskDetailPage task={task()} {...h} />);
		fireEvent.click(screen.getByText("Delete"));
		expect(h.onDelete).toHaveBeenCalledWith("task_1");
	});

	it("surfaces an error message", () => {
		render(<TaskDetailPage task={task()} error="enable it first" {...handlers()} />);
		expect(screen.getByText("enable it first")).toBeInTheDocument();
	});
});
