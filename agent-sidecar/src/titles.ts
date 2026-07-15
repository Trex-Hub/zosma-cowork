export const TITLE_SYSTEM_PROMPT =
	"You generate short chat titles. Reply with ONLY a 3-6 word title (no quotes, no punctuation at the end). Title Case. Summarize the user's intent. Be specific and concrete — avoid generic titles like 'Status Update', 'Help', or 'Question'.";

export function cleanSummaryTitle(raw: string): string {
	let title = raw.trim();

	const quotePairs = [
		['"', '"'],
		["'", "'"],
		["“", "”"],
		["‘", "’"],
	];
	for (const [open, close] of quotePairs) {
		if (title.startsWith(open) && title.endsWith(close)) {
			title = title.slice(1, -1).trim();
			break;
		}
	}

	title = title.replace(/\s+/g, " ").trim();
	if (title.endsWith(".")) title = title.slice(0, -1).trim();

	return title.slice(0, 80).trim();
}

export function prepareTitleInput(text: string): string {
	return text.trim().slice(0, 2000);
}
