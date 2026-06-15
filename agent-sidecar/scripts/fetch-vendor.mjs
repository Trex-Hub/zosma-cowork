// Fetch and pin vendored pi extensions used by the agent sidecar.
//
// Runs as `agent-sidecar/package.json`'s `postinstall` so every `npm ci`
// (CI, local dev, tauri's beforeBuildCommand) populates the vendor tree
// before tsc / esbuild see it. Idempotent: skips the clone when the local
// `.bridge-commit` marker already matches the pinned commit.
//
// pi-anthropic-messages is required for Claude Pro/Max OAuth to work
// against the anthropic-messages endpoint — see
// `agent-sidecar/src/vendor/anthropic-messages/README.md` for the
// protocol details. Without the bridge, Anthropic fingerprints our
// requests as "third-party app" and rejects them with the extra-usage
// 400 error.

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sidecarDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const VENDORED = [
	{
		name: "anthropic-messages",
		repo: "https://github.com/BlackBeltTechnology/pi-anthropic-messages.git",
		// v0.3.1 — peer dep targets @earendil-works/pi-coding-agent (our fork),
		// so no type-patching is needed at build time.
		commit: "5370ac3",
		// Directories/files in the upstream tree we don't need at build time.
		trim: [".git", "__tests__", "openspec", ".pi", "CHANGELOG.md"],
	},
	{
		name: "pi-routines",
		repo: "https://github.com/zosmaai/pi-routines.git",
		// Forked scheduler fired ONLY inside Cowork (sets
		// globalThis.__PI_ROUTINES_ON_FIRE). Imported from src/index.ts; see
		// agent-sidecar/src/index.ts. Bump this SHA to pull fork changes.
		commit: "2cbada4da4bc10b4c80d9c8d111ae96fa50132d0",
		trim: [".git", "src/index.test.ts", "node_modules"],
		// The fork's relative imports use `.ts` extensions (jiti-friendly). The
		// sidecar's tsc *emits*, which forbids importing `.ts` extensions, so
		// rewrite them to `.js` in the cloned tree.
		rewriteTsExtensions: true,
	},
];

/** Recursively rewrite relative `.ts` import specifiers to `.js`. */
function rewriteTsImports(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			rewriteTsImports(full);
		} else if (entry.name.endsWith(".ts")) {
			const src = readFileSync(full, "utf-8");
			const out = src.replace(
				/((?:from|import)\s*\(?\s*["'])(\.[^"']*?)\.ts(["'])/g,
				"$1$2.js$3",
			);
			if (out !== src) writeFileSync(full, out, "utf-8");
		}
	}
}

for (const v of VENDORED) {
	const dest = join(sidecarDir, "src", "vendor", v.name);
	const marker = join(dest, ".bridge-commit");
	if (existsSync(marker) && readFileSync(marker, "utf-8").trim() === v.commit) {
		console.log(`[fetch-vendor] ${v.name} already at ${v.commit}`);
		continue;
	}
	console.log(`[fetch-vendor] cloning ${v.name} @ ${v.commit}…`);
	rmSync(dest, { recursive: true, force: true });
	mkdirSync(dest, { recursive: true });
	execSync(`git clone --quiet ${v.repo} "${dest}"`, { stdio: "inherit" });
	execSync(`git -C "${dest}" checkout --quiet ${v.commit}`, { stdio: "inherit" });
	for (const trash of v.trim) {
		rmSync(join(dest, trash), { recursive: true, force: true });
	}
	if (v.rewriteTsExtensions) {
		rewriteTsImports(dest);
	}
	writeFileSync(marker, `${v.commit}\n`, "utf-8");
	console.log(`[fetch-vendor] ${v.name} ready`);
}
