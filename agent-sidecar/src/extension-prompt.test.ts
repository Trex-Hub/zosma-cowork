/**
 * Tests for the `<available_extensions>` system-prompt catalog (issue #161).
 *
 * pi tells the model about installed skills via `<available_skills>` but
 * never about extensions, so the model can't attribute a tool back to its
 * owning extension. This mirrors that pattern, built from
 * `ExtensionRegistration[]` (ground truth of what each extension actually
 * registered — see disk-extension-loader.ts) rather than pi's opaque
 * `<inline:N>` bookkeeping or the Settings-panel discovery scan.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtensionRegistration } from "./disk-extension-loader.js";
import { formatExtensionsForPrompt } from "./extension-prompt.js";

function reg(overrides: Partial<ExtensionRegistration>): ExtensionRegistration {
	return {
		path: "/tmp/does-not-matter/index.js",
		source: "npm:demo",
		tools: [],
		commands: [],
		hooks: [],
		loaded: true,
		...overrides,
	};
}

describe("formatExtensionsForPrompt", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "zosma-ext-prompt-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("returns empty string when there are no registrations", () => {
		expect(formatExtensionsForPrompt([])).toBe("");
	});

	it("returns empty string when no registration finished loading", () => {
		const r = reg({ loaded: false, tools: ["web_search"] });
		expect(formatExtensionsForPrompt([r])).toBe("");
	});

	it("emits an <available_extensions> block with name/source/tools", () => {
		const modDir = join(dir, "pi-web-access");
		mkdirSync(modDir, { recursive: true });
		writeFileSync(
			join(modDir, "package.json"),
			JSON.stringify({ name: "pi-web-access", version: "0.10.7" }),
		);
		const r = reg({
			path: join(modDir, "index.js"),
			source: "npm:pi-web-access",
			tools: ["web_search", "fetch_content"],
		});

		const out = formatExtensionsForPrompt([r]);
		expect(out).toContain("<available_extensions>");
		expect(out).toContain("<name>pi-web-access</name>");
		expect(out).toContain("<source>npm:pi-web-access</source>");
		expect(out).toContain("<tools>web_search, fetch_content</tools>");
		expect(out).toContain("</available_extensions>");
	});

	it("falls back to the source string when no package.json name is found", () => {
		const r = reg({ path: join(dir, "loose-ext.ts"), source: "npm:unresolvable" });
		const out = formatExtensionsForPrompt([r]);
		expect(out).toContain("<name>npm:unresolvable</name>");
	});

	it("omits <tools>/<commands>/<hooks> tags when empty", () => {
		const r = reg({ tools: [], commands: [], hooks: [] });
		const out = formatExtensionsForPrompt([r]);
		expect(out).not.toContain("<tools>");
		expect(out).not.toContain("<commands>");
		expect(out).not.toContain("<hooks>");
	});

	it("includes commands and hooks when present", () => {
		const r = reg({ commands: ["search"], hooks: ["session_start"] });
		const out = formatExtensionsForPrompt([r]);
		expect(out).toContain("<commands>search</commands>");
		expect(out).toContain("<hooks>session_start</hooks>");
	});

	it("excludes unloaded registrations but keeps loaded ones", () => {
		const loadedReg = reg({ source: "npm:ok", tools: ["a"] });
		const failedReg = reg({ source: "npm:broken", loaded: false });
		const out = formatExtensionsForPrompt([loadedReg, failedReg]);
		expect(out).toContain("npm:ok");
		expect(out).not.toContain("npm:broken");
	});

	it("escapes XML special characters in the source", () => {
		const r = reg({ source: "git:https://example.com/a&b" });
		const out = formatExtensionsForPrompt([r]);
		expect(out).toContain("a&amp;b");
	});
});
