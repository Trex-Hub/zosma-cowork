import type { ChatMessage, ToolCallInfo } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStateStatus = "idle" | "thinking" | "tool_call" | "responding" | "error";

export interface RemoteChatState {
	messages: ChatMessage[];
	streamingMessage: ChatMessage | null;
	isRunning: boolean;
	status: StreamStateStatus;
	error: string | null;
	sendMessage: (text: string) => void;
	abort: () => void;
	retry: () => void;
	isConnected: boolean;
}

interface UseRemoteChatOptions {
	pin: string;
	token: string;
}

function makeMessage(
	role: ChatMessage["role"],
	content: string,
	extra?: Partial<ChatMessage>,
): ChatMessage {
	return {
		id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		role,
		content,
		timestamp: Date.now(),
		...extra,
	};
}

/**
 * Manages a chat session via the remote server's HTTP + SSE API.
 *
 * Replaces `usePiStream` for browser-based mobile clients that cannot
 * access Tauri's `invoke()`.
 */
export function useRemoteChat(_options: UseRemoteChatOptions): RemoteChatState {
	const messagesRef = useRef<ChatMessage[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [status, setStatus] = useState<StreamStateStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);
	const lastPromptRef = useRef<string>("");

	const { pin } = _options;

	// ── Base URL for API calls ────────────────────────────────────────
	const base = window.location.origin;
	const auth = (() => {
		const params = new URLSearchParams({ pin });
		return `?${params.toString()}`;
	})();

	// ── Connect to SSE event stream ───────────────────────────────────
	useEffect(() => {
		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let mounted = true;

		function connect() {
			if (!mounted) return;
			if (eventSource) eventSource.close();

			eventSource = new EventSource(`${base}/api/events${auth}`);
			eventSourceRef.current = eventSource;

			eventSource.onopen = () => {
				if (mounted) setIsConnected(true);
			};

			eventSource.onmessage = (event) => {
				if (!mounted) return;
				try {
					const data = JSON.parse(event.data);
					handleEvent(data);
				} catch {
					// Ignore parse errors
				}
			};

			eventSource.onerror = () => {
				if (!mounted) return;
				setIsConnected(false);
				eventSource?.close();
				// Reconnect after 5s
				reconnectTimer = setTimeout(connect, 5000);
			};
		}

		connect();

		return () => {
			mounted = false;
			if (eventSource) eventSource.close();
			if (reconnectTimer) clearTimeout(reconnectTimer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [base, auth]);

	// ── Event handler ─────────────────────────────────────────────────
	function handleEvent(raw: unknown) {
		const event = raw as {
			type?: string;
			data?: {
				type?: string;
				id?: string;
				event?: Record<string, unknown>;
			};
		};

		if (!event.type) return;

		switch (event.type) {
			case "connected": {
				setIsConnected(true);
				break;
			}

			case "ready": {
				setIsConnected(true);
				break;
			}

			case "event": {
				const e = event.data?.event;
				if (!e?.kind) return;
				handleStreamEvent(e.kind as string, e);
				break;
			}

			case "done": {
				setIsRunning(false);
				setStatus("idle");
				setStreamingMessage(null);
				break;
			}

			case "error": {
				setIsRunning(false);
				setStatus("error");
				setError((event.data?.event?.message as string) || "An error occurred");
				break;
			}
		}
	}

	// ── Stream event types (mirrors sidecar event kinds) ──────────────
	function handleStreamEvent(kind: string, e: Record<string, unknown>) {
		switch (kind) {
			case "message_start": {
				setIsRunning(true);
				setStatus("thinking");
				setError(null);
				// New user message echoed back
				const userContent = (e.content as string) || "";
				if (userContent) {
					const msg = makeMessage("user", userContent);
					messagesRef.current = [...messagesRef.current, msg];
					setMessages(messagesRef.current);
				}
				break;
			}

			case "thinking_start": {
				setStatus("thinking");
				break;
			}

			case "text_delta": {
				setStatus("responding");
				const delta = (e.delta as string) || (e.content as string) || "";
				setStreamingMessage((prev) => {
					if (prev) {
						return { ...prev, content: prev.content + delta, isStreaming: true };
					}
					return makeMessage("assistant", delta, { isStreaming: true });
				});
				break;
			}

			case "tool_call_start": {
				setStatus("tool_call");
				const toolName = (e.name as string) || (e.tool as string) || "unknown";
				const args = (e.args as Record<string, unknown>) || {};
				setStreamingMessage((prev) => {
					const existing = prev || makeMessage("assistant", "", { isStreaming: true });
					const toolCall: ToolCallInfo = {
						id: `tool-${Date.now()}`,
						name: toolName,
						args,
						status: "running",
					};
					return {
						...existing,
						toolCalls: [...(existing.toolCalls || []), toolCall],
					};
				});
				break;
			}

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			case "tool_call_end": {
				// Tool finished — nothing special to do, stream will continue
				break;
			}

			case "content_block_stop":
			case "message_stop": {
				// Finalize the streaming message into the messages array
				setStreamingMessage((prev) => {
					if (prev) {
						const finalized: ChatMessage = { ...prev, isStreaming: false };
						messagesRef.current = [...messagesRef.current, finalized];
						setMessages(messagesRef.current);
					}
					return null;
				});
				break;
			}

			case "error": {
				setStatus("error");
				setError((e.message as string) || "An error occurred");
				setIsRunning(false);
				break;
			}
		}
	}

	// ── Send message via HTTP POST ────────────────────────────────────
	const sendMessage = useCallback(
		async (text: string) => {
			if (!text.trim() || isRunning) return;

			lastPromptRef.current = text;
			setError(null);

			try {
				const res = await fetch(`${base}/api/command${auth}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ type: "message", content: text }),
				});

				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					setError(data.message as string || `Server error (${res.status})`);
					setStatus("error");
				}
				// response is 202 Accepted — events come via SSE
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send message");
				setStatus("error");
			}
		},
		[base, auth, isRunning],
	);

	// ── Abort current stream ─────────────────────────────────────────
	const abort = useCallback(() => {
		fetch(`${base}/api/command${auth}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "abort" }),
		}).catch(() => {});
		setIsRunning(false);
		setStatus("idle");
		setStreamingMessage(null);
	}, [base, auth]);

	// ── Retry last message ────────────────────────────────────────────
	const retry = useCallback(() => {
		if (lastPromptRef.current) {
			sendMessage(lastPromptRef.current);
		}
	}, [sendMessage]);

	return {
		messages,
		streamingMessage,
		isRunning,
		status,
		error,
		sendMessage,
		abort,
		retry,
		isConnected,
	};
}
