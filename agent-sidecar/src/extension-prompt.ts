/**
 * `<available_extensions>` system-prompt catalog (issue #161).
 *
 * pi tells the model about installed skills (`<available_skills>`, built by
 * pi's own `formatSkillsForPrompt`) but never about extensions — the model
 * sees the resulting tools as if they were built-in, with no way to attribute
 * a tool back to its owning extension. This mirrors that pattern for
 * extensions, built from `ExtensionRegistration[]` — ground truth of what
 * each extension actually registered, tracked live in
 * disk-extension-loader.ts as its factory runs — rather than pi's
 * `Extension.path`, which is a synthetic `<inline:N>` for every
 * factory-loaded extension (disk-loaded AND Cowork's vendored built-ins
 * alike) and can't be told apart or carry a real source. Only registrations
 * whose factory completed without throwing (`loaded: true`) are included, so
 * this never advertises an extension whose tools didn't truly reach the model.
 */

import type { ExtensionRegistration } from "./disk-extension-loader.js";
import { nearestPackageDir, readExtensionMeta } from "./extension-manager.js";

function friendlyName(reg: ExtensionRegistration): string {
	const meta = readExtensionMeta(nearestPackageDir(reg.path));
	return meta?.name || reg.source;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/**
 * Build the `<available_extensions>` block for the given extension
 * registrations. Returns "" when none loaded, so no empty block/prompt noise
 * is ever emitted.
 */
export function formatExtensionsForPrompt(registrations: ExtensionRegistration[]): string {
	const loaded = registrations.filter((r) => r.loaded);
	if (loaded.length === 0) return "";

	const lines = [
		"\n\nThe following extensions are installed and have registered tools, commands, and/or hooks below.",
		"Use this to attribute a tool back to the extension that provides it when asked.",
		"",
		"<available_extensions>",
	];
	for (const reg of loaded) {
		lines.push("  <extension>");
		lines.push(`    <name>${escapeXml(friendlyName(reg))}</name>`);
		lines.push(`    <source>${escapeXml(reg.source)}</source>`);
		if (reg.tools.length > 0) lines.push(`    <tools>${escapeXml(reg.tools.join(", "))}</tools>`);
		if (reg.commands.length > 0)
			lines.push(`    <commands>${escapeXml(reg.commands.join(", "))}</commands>`);
		if (reg.hooks.length > 0) lines.push(`    <hooks>${escapeXml(reg.hooks.join(", "))}</hooks>`);
		lines.push("  </extension>");
	}
	lines.push("</available_extensions>");
	return lines.join("\n");
}
