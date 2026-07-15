export function deriveRawTitle(text: unknown, withEllipsis = false): string {
	if (typeof text !== "string" || text.trim().length === 0) return "Chat";
	if (withEllipsis && text.length > 80) return `${text.slice(0, 77)}...`;
	return text.slice(0, 80);
}
