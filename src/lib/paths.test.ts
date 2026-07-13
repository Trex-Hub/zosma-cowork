import { describe, expect, it } from "vitest";
import { displayPath } from "./paths";

describe("displayPath", () => {
	it("collapses home to ~", () => {
		expect(displayPath("/Users/dev", "/Users/dev")).toBe("~");
	});

	it("collapses paths under home to ~/sub", () => {
		expect(displayPath("/Users/dev/projects/foo", "/Users/dev")).toBe("~/projects/foo");
	});

	it("returns absolute path unchanged when outside home", () => {
		expect(displayPath("/opt/other", "/Users/dev")).toBe("/opt/other");
	});

	it("treats a missing folder as home", () => {
		expect(displayPath(undefined, "/Users/dev")).toBe("~");
	});

	it("returns the raw folder when homeDir is unknown", () => {
		expect(displayPath("/Users/dev/projects/foo", undefined)).toBe("/Users/dev/projects/foo");
	});
});
