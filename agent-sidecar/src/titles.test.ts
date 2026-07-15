import { describe, expect, it } from "vitest";
import { cleanSummaryTitle, prepareTitleInput } from "./titles.js";

describe("cleanSummaryTitle", () => {
	it("trims whitespace", () => {
		expect(cleanSummaryTitle("  Hello World  ")).toBe("Hello World");
	});

	it("removes surrounding quotes", () => {
		expect(cleanSummaryTitle('"Fix the Login Bug"')).toBe("Fix the Login Bug");
		expect(cleanSummaryTitle("'Refactor Auth'")).toBe("Refactor Auth");
		expect(cleanSummaryTitle("“Review the PR”")).toBe("Review the PR");
	});

	it("removes a trailing period", () => {
		expect(cleanSummaryTitle("Plan the Migration.")).toBe("Plan the Migration");
	});

	it("collapses internal whitespace", () => {
		expect(cleanSummaryTitle("Plan   the\nMigration")).toBe("Plan the Migration");
	});

	it("caps at 80 characters", () => {
		const long = "a".repeat(100);
		expect(cleanSummaryTitle(long)).toHaveLength(80);
	});
});

describe("prepareTitleInput", () => {
	it("trims and truncates long input", () => {
		const long = "a ".repeat(1500);
		const result = prepareTitleInput(long);
		expect(result.length).toBeLessThanOrEqual(2000);
		expect(result.startsWith("a a")).toBe(true);
	});

	it("leaves short input unchanged", () => {
		expect(prepareTitleInput("  Short status update  ")).toBe("Short status update");
	});
});
