/**
 * Zosma Cowork — Chat content width control
 *
 * Lets users pick how wide the readable message column is. The content
 * column is centered; the message background bands still span full width.
 * Stored in localStorage so it persists across sessions.
 */

const STORAGE_KEY = "zosma-chat-width";

export type ChatWidth = "small" | "medium" | "large";

/** Max-width (px) for each preset's centered content column. */
export const CHAT_WIDTH_PX: Record<ChatWidth, number> = {
	small: 640,
	medium: 820,
	large: 1080,
};

/** Human-readable labels for each preset. */
export const CHAT_WIDTH_LABELS: Record<ChatWidth, string> = {
	small: "Small",
	medium: "Medium",
	large: "Large",
};

export const CHAT_WIDTH_PRESETS: ChatWidth[] = ["small", "medium", "large"];

/** Get the persisted chat width, falling back to "medium". */
export function getChatWidth(): ChatWidth {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "small" || saved === "medium" || saved === "large") return saved;
	} catch {
		// localStorage unavailable — use default
	}
	return "medium";
}

/** Persist a chat width choice. */
export function setChatWidth(width: ChatWidth): void {
	try {
		localStorage.setItem(STORAGE_KEY, width);
	} catch {
		// Ignore
	}
}

/** Apply the width to the document via the --chat-max-width CSS variable. */
export function applyChatWidth(width: ChatWidth): void {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty("--chat-max-width", `${CHAT_WIDTH_PX[width]}px`);
}

/** Initialize chat width from saved preference (call once on app load). */
export function initChatWidth(): void {
	applyChatWidth(getChatWidth());
}
