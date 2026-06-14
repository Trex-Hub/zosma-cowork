import { describe, expect, it } from "vitest";
import { formatRelative, humanizeCron } from "./cron";

describe("humanizeCron", () => {
	it("every minute", () => {
		expect(humanizeCron("* * * * *")).toBe("Every minute");
	});
	it("every N minutes", () => {
		expect(humanizeCron("*/5 * * * *")).toBe("Every 5 minutes");
	});
	it("every hour", () => {
		expect(humanizeCron("0 * * * *")).toBe("Every hour");
	});
	it("minutes past every hour", () => {
		expect(humanizeCron("30 * * * *")).toBe("At 30 minutes past every hour");
	});
	it("every N hours", () => {
		expect(humanizeCron("0 */6 * * *")).toBe("Every 6 hours");
	});
	it("daily at a time (AM)", () => {
		expect(humanizeCron("0 9 * * *")).toBe("Every day at 9:00 AM");
	});
	it("daily at a time (PM, padded minutes)", () => {
		expect(humanizeCron("5 14 * * *")).toBe("Every day at 2:05 PM");
	});
	it("midnight maps to 12:00 AM", () => {
		expect(humanizeCron("0 0 * * *")).toBe("Every day at 12:00 AM");
	});
	it("weekdays", () => {
		expect(humanizeCron("30 8 * * 1-5")).toBe("Weekdays at 8:30 AM");
	});
	it("weekly on a named day", () => {
		expect(humanizeCron("0 9 * * 1")).toBe("Every Monday at 9:00 AM");
	});
	it("sunday as 0 and as 7", () => {
		expect(humanizeCron("0 9 * * 0")).toBe("Every Sunday at 9:00 AM");
		expect(humanizeCron("0 9 * * 7")).toBe("Every Sunday at 9:00 AM");
	});
	it("monthly on a day-of-month", () => {
		expect(humanizeCron("0 0 1 * *")).toBe("Monthly on day 1 at 12:00 AM");
	});
	it("falls back to the raw expression for unrecognised shapes", () => {
		expect(humanizeCron("0 9 1,15 * *")).toBe("0 9 1,15 * *");
		expect(humanizeCron("weird")).toBe("weird");
	});
});

describe("formatRelative", () => {
	const now = new Date("2026-06-14T12:00:00.000Z").getTime();
	it("returns — for missing/invalid", () => {
		expect(formatRelative(undefined, now)).toBe("—");
		expect(formatRelative("nope", now)).toBe("—");
	});
	it("just now near zero", () => {
		expect(formatRelative("2026-06-14T12:00:10.000Z", now)).toBe("just now");
	});
	it("future minutes", () => {
		expect(formatRelative("2026-06-14T12:05:00.000Z", now)).toBe("in 5m");
	});
	it("past hours", () => {
		expect(formatRelative("2026-06-14T10:00:00.000Z", now)).toBe("2h ago");
	});
	it("future days", () => {
		expect(formatRelative("2026-06-16T12:00:00.000Z", now)).toBe("in 2d");
	});
});
