import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	type ExtensionRegistration,
	makeExtensionFactory,
	readPiPackages,
} from "./disk-extension-loader.js";

function emptyRegistration(path: string, source = "npm:demo"): ExtensionRegistration {
	return { path, source, tools: [], commands: [], hooks: [], loaded: false };
}

// ── readPiPackages ────────────────────────────────────────────────────

describe("readPiPackages", () => {
	it("returns [] when settings.json is absent", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-empty-"));
		try {
			expect(readPiPackages(dir)).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns the packages array from settings.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-pkgs-"));
		try {
			writeFileSync(
				join(dir, "settings.json"),
				JSON.stringify({
					packages: ["npm:pi-web-access", "git:github.com/foo/bar", "../local"],
					defaultModel: "sonnet",
				}),
			);
			expect(readPiPackages(dir)).toEqual([
				"npm:pi-web-access",
				"git:github.com/foo/bar",
				"../local",
			]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("filters out non-string package entries", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-mixed-"));
		try {
			writeFileSync(
				join(dir, "settings.json"),
				JSON.stringify({ packages: ["npm:ok", { source: "npm:obj" }, 42, null] }),
			);
			// Only the plain string survives the string-only filter.
			expect(readPiPackages(dir)).toEqual(["npm:ok"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns [] on malformed JSON", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-bad-"));
		try {
			writeFileSync(join(dir, "settings.json"), "{ not valid json");
			expect(readPiPackages(dir)).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns [] when packages is missing or not an array", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-nopkgs-"));
		try {
			writeFileSync(join(dir, "settings.json"), JSON.stringify({ packages: "nope" }));
			expect(readPiPackages(dir)).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

// ── makeExtensionFactory ──────────────────────────────────────────────

describe("makeExtensionFactory", () => {
	it("returns a function (deferred loader) without importing eagerly", () => {
		// Building the factory must NOT touch the filesystem/jiti — loading is
		// deferred until the resource loader invokes it. A nonexistent path is
		// therefore fine at construction time.
		const factory = makeExtensionFactory("/does/not/exist/ext.ts");
		expect(typeof factory).toBe("function");
	});

	it("rejects with the real entry path when the module cannot be loaded", async () => {
		const factory = makeExtensionFactory("/does/not/exist/ext.ts");
		const fakeApi = {} as Parameters<typeof factory>[0];
		await expect(factory(fakeApi)).rejects.toThrow("/does/not/exist/ext.ts");
	});

	it("loads a real extension module and invokes its default factory", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-ext-"));
		try {
			const entry = join(dir, "ext.ts");
			// Minimal extension: default-exported factory that calls a method on
			// the provided api. No pi/typebox imports, so it loads via jiti alone.
			writeFileSync(
				entry,
				"export default async function(pi){ pi.registerTool({ name: 'demo' }); }\n",
			);
			const calls: string[] = [];
			const fakeApi = {
				registerTool: (t: { name: string }) => calls.push(t.name),
			} as unknown as Parameters<ReturnType<typeof makeExtensionFactory>>[0];
			await makeExtensionFactory(entry)(fakeApi);
			expect(calls).toEqual(["demo"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects when the module has no default-exported function", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-nofac-"));
		try {
			const entry = join(dir, "bad.ts");
			writeFileSync(entry, "export const notDefault = 1;\n");
			const fakeApi = {} as Parameters<ReturnType<typeof makeExtensionFactory>>[0];
			await expect(makeExtensionFactory(entry)(fakeApi)).rejects.toThrow(
				"no default-exported factory",
			);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("records registered tools, commands, and hooks into the passed registration", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-reg-"));
		try {
			const entry = join(dir, "ext.ts");
			writeFileSync(
				entry,
				[
					"export default async function(pi){",
					"  pi.registerTool({ name: 'web_search' });",
					"  pi.registerTool({ name: 'fetch_content' });",
					"  pi.registerCommand('search', {});",
					"  pi.on('session_start', () => {});",
					"}",
				].join("\n"),
			);
			const calls: string[] = [];
			const fakeApi = {
				registerTool: (t: { name: string }) => calls.push(`tool:${t.name}`),
				registerCommand: (n: string) => calls.push(`command:${n}`),
				on: (e: string) => calls.push(`on:${e}`),
			} as unknown as Parameters<ReturnType<typeof makeExtensionFactory>>[0];

			const reg = emptyRegistration(entry, "npm:demo-ext");
			await makeExtensionFactory(entry, reg)(fakeApi);

			// Still calls through to the real api (tracking must not swallow calls).
			expect(calls).toEqual([
				"tool:web_search",
				"tool:fetch_content",
				"command:search",
				"on:session_start",
			]);
			expect(reg.tools).toEqual(["web_search", "fetch_content"]);
			expect(reg.commands).toEqual(["search"]);
			expect(reg.hooks).toEqual(["session_start"]);
			expect(reg.loaded).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("leaves the registration unloaded when the extension factory throws", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-reg-throw-"));
		try {
			const entry = join(dir, "ext.ts");
			writeFileSync(
				entry,
				"export default async function(pi){ pi.registerTool({ name: 'x' }); throw new Error('boom'); }\n",
			);
			const fakeApi = {
				registerTool: () => {},
			} as unknown as Parameters<ReturnType<typeof makeExtensionFactory>>[0];

			const reg = emptyRegistration(entry);
			await expect(makeExtensionFactory(entry, reg)(fakeApi)).rejects.toThrow("boom");
			expect(reg.loaded).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not track when no registration bucket is passed (backward compatible)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-reg-none-"));
		try {
			const entry = join(dir, "ext.ts");
			writeFileSync(
				entry,
				"export default async function(pi){ pi.registerTool({ name: 'demo' }); }\n",
			);
			const calls: string[] = [];
			const fakeApi = {
				registerTool: (t: { name: string }) => calls.push(t.name),
			} as unknown as Parameters<ReturnType<typeof makeExtensionFactory>>[0];
			await makeExtensionFactory(entry)(fakeApi);
			expect(calls).toEqual(["demo"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
