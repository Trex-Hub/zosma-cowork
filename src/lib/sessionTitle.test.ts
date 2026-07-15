import { describe, expect, it } from "vitest";
import { deriveRawTitle } from "./sessionTitle";

describe("deriveRawTitle", () => {
	it("returns 'Chat' for empty or non-string input", () => {
		expect(deriveRawTitle("")).toBe("Chat");
		expect(deriveRawTitle("   ")).toBe("Chat");
		expect(deriveRawTitle(null)).toBe("Chat");
		expect(deriveRawTitle(undefined)).toBe("Chat");
		expect(deriveRawTitle(123)).toBe("Chat");
	});

	it("slices to 80 characters", () => {
		const long = "a".repeat(100);
		expect(deriveRawTitle(long)).toBe("a".repeat(80));
	});

	it("adds ellipsis when requested", () => {
		const long = "a".repeat(100);
		expect(deriveRawTitle(long, true)).toBe(`${"a".repeat(77)}...`);
	});

	it("does not add ellipsis for short text", () => {
		expect(deriveRawTitle("hello world", true)).toBe("hello world");
	});

	it("preserves leading and trailing whitespace in returned title", () => {
		expect(deriveRawTitle("  hello world  ")).toBe("  hello world  ");
	});
});
