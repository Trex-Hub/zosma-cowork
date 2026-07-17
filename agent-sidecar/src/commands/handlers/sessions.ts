/**
 * Session command handlers — backed by pi-coding-agent's native SessionManager
 * (auto-persists to ~/.pi/agent/sessions/). Cowork no longer keeps a parallel
 * ~/.zosmaai/cowork/sessions store; pinning + custom titles live in
 * ~/.pi/agent/cowork-meta.json via pi-session-store.
 *
 * Commands: reload, new_session, get_workspace, list_sessions, save_session
 * (no-op — pi auto-persists), load_session, delete_session, rename_session,
 * set_session_pinned, search_sessions.
 */

import { send, log } from "../../protocol.js";
import { subscribeSession } from "../../prompt-runner.js";
import type { HandlerDependencies } from "../handler-registry.js";
import { resolveWorkspace, defaultWorkspaceDir, piAgentDir } from "../../agent-init.js";
import {
	listPiSessions,
	loadPiSession,
	deletePiSession,
	renamePiSession,
	setPiSessionPinned,
	searchPiSessions,
} from "../../pi-session-store.js";
import { completeSimple, type Api, type Model } from "@earendil-works/pi-ai/compat";
import {
	cleanSummaryTitle,
	prepareTitleInput,
	TITLE_SYSTEM_PROMPT,
} from "../../titles.js";

export async function handleReload(deps: HandlerDependencies, cmd: any): Promise<void> {
	await deps.initAgent(deps.zosmaDir);
	send({ type: "result", id: cmd.id, data: { success: true } });
}

/** Build a fresh persisting pi session bound to `cwd`; return its file path. */
async function spawnSession(deps: HandlerDependencies, cwd: string) {
	const { SessionManager, createAgentSession } = await import("@earendil-works/pi-coding-agent");
	const sessionManager = SessionManager.create(cwd);
	const result = await createAgentSession({
		cwd,
		authStorage: deps.authStorage!,
		modelRegistry: deps.modelRegistry!,
		sessionManager,
		settingsManager: deps.settingsManager!,
		resourceLoader: deps.resourceLoader!,
	});
	if (deps.session) deps.session.abort();
	deps.setSession(result.session);
	deps.setSessionManager(sessionManager);
	subscribeSession(result.session);
	await deps.bindExtensionUi(result.session);
	return sessionManager.getSessionFile();
}

export async function handleNewSession(deps: HandlerDependencies, cmd: any): Promise<void> {
	if (!deps.authStorage || !deps.modelRegistry || !deps.settingsManager || !deps.resourceLoader) {
		send({ type: "error", id: cmd.id, error: "Agent not initialized" });
		return;
	}
	const requestedCwd = resolveWorkspace(cmd.cwd, deps.zosmaDir);
	if (requestedCwd !== deps.workspaceCwd) {
		deps.setWorkspaceCwd(requestedCwd);
		log("new_session: workspace → %s", deps.workspaceCwd);
		const { buildResourceLoader } = await import("../../agent-init.js");
		deps.setResourceLoader(
			await buildResourceLoader(deps.workspaceCwd, deps.zosmaDir, deps.settingsManager),
		);
	}
	const file = await spawnSession(deps, deps.workspaceCwd);
	send({ type: "result", id: cmd.id, data: { success: true, cwd: deps.workspaceCwd, file } });
}

export async function handleGetWorkspace(deps: HandlerDependencies, cmd: any): Promise<void> {
	send({
		type: "result",
		id: cmd.id,
		data: { cwd: deps.workspaceCwd, default: defaultWorkspaceDir(deps.zosmaDir) },
	});
}

export async function handleListSessions(deps: HandlerDependencies, cmd: any): Promise<void> {
	// Scope to the active workspace folder (pi-style) unless the UI asks for all.
	const cwd = cmd.allFolders ? undefined : deps.workspaceCwd;
	const sessions = await listPiSessions(piAgentDir(), cwd);
	send({ type: "result", id: cmd.id, data: { sessions } });
}

/** No-op: pi persists sessions during the agent loop. Kept for protocol compat. */
export async function handleSaveSession(_deps: HandlerDependencies, cmd: any): Promise<void> {
	send({ type: "done", id: cmd.id });
}

export async function handleLoadSession(deps: HandlerDependencies, cmd: any): Promise<void> {
	try {
		const path = cmd.sessionFile as string;
		const loaded = loadPiSession(path);

		if (deps.authStorage && deps.modelRegistry && deps.settingsManager && deps.resourceLoader) {
			const { createAgentSession } = await import("@earendil-works/pi-coding-agent");
			const { buildResourceLoader } = await import("../../agent-init.js");

			const sessionCwd = resolveWorkspace(loaded.cwd, deps.zosmaDir);
			if (sessionCwd !== deps.workspaceCwd) {
				deps.setWorkspaceCwd(sessionCwd);
				deps.setResourceLoader(
					await buildResourceLoader(sessionCwd, deps.zosmaDir, deps.settingsManager),
				);
				log("load_session: workspace → %s", deps.workspaceCwd);
			} else {
				// Best-effort refresh. Mirrors buildResourceLoader's tolerance:
				// a failing npm-sourced pi package (e.g. pi-web-access) must NOT
				// abort loading a session — we already have its messages.
				try {
					await deps.resourceLoader.reload();
				} catch (err) {
					log(
						"load_session: resource reload failed (continuing): %s",
						err instanceof Error ? err.message : String(err),
					);
				}
			}
			log("load_session: rebinding agent session for %s", path);
			if (deps.session) deps.session.abort();

			// Rebind the agent to the OPENED (persisting) session manager so
			// continued turns append to the same file with full prior context.
			log("load_session: creating agent session (cwd=%s)", deps.workspaceCwd);
			const resumed = await createAgentSession({
				cwd: deps.workspaceCwd,
				authStorage: deps.authStorage,
				modelRegistry: deps.modelRegistry,
				sessionManager: loaded.manager,
				settingsManager: deps.settingsManager,
				resourceLoader: deps.resourceLoader,
			});
			log("load_session: session created, subscribing");
			deps.setSession(resumed.session);
			deps.setSessionManager(loaded.manager);
			subscribeSession(resumed.session);
			await deps.bindExtensionUi(resumed.session);
			log("load_session: ready to send result");
		}

		send({
			type: "result",
			id: cmd.id,
			data: {
				messages: loaded.messages,
				title: loaded.title,
				model: loaded.model,
				provider: loaded.provider,
				cwd: deps.workspaceCwd,
			},
		});
	} catch (err) {
		send({
			type: "error",
			id: cmd.id,
			message: err instanceof Error ? err.message : String(err),
		});
	}
}

export async function handleDeleteSession(_deps: HandlerDependencies, cmd: any): Promise<void> {
	const deleted = deletePiSession(piAgentDir(), cmd.sessionFile);
	send({ type: "result", id: cmd.id, data: { deleted } });
}

export async function handleRenameSession(_deps: HandlerDependencies, cmd: any): Promise<void> {
	const renamed = renamePiSession(piAgentDir(), cmd.sessionFile, cmd.title);
	send({ type: "result", id: cmd.id, data: { renamed } });
}

export async function handleSetSessionPinned(_deps: HandlerDependencies, cmd: any): Promise<void> {
	const ok = setPiSessionPinned(piAgentDir(), cmd.sessionFile, cmd.pinned);
	send({ type: "result", id: cmd.id, data: { ok, pinned: cmd.pinned } });
}

export async function handleSearchSessions(deps: HandlerDependencies, cmd: any): Promise<void> {
	const cwd = cmd.allFolders ? undefined : deps.workspaceCwd;
	const matches = await searchPiSessions(piAgentDir(), cmd.query, cwd);
	send({ type: "result", id: cmd.id, data: { matches } });
}

/**
 * summarize_title — one-shot LLM call that turns the session's first user
 * message into a short display title. Uses the currently-active model + its
 * bound auth, and returns { title } on success. Sidebar renames via a
 * follow-up rename_session command so the human title survives reload.
 */
export async function handleSummarizeTitle(
	deps: HandlerDependencies,
	cmd: any,
): Promise<void> {
	log("summarize_title: received firstMessage length=%d", cmd.firstMessage?.length ?? 0);
	if (!deps.initialized || !deps.modelRegistry || !deps.session) {
		send({ type: "error", id: cmd.id, message: "Not initialized" });
		return;
	}
	const model = deps.session.model as Model<Api> | undefined;
	if (!model) {
		send({ type: "error", id: cmd.id, message: "No active model" });
		return;
	}
	try {
		const auth = await deps.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			send({ type: "error", id: cmd.id, message: auth.error });
			return;
		}
		const text = prepareTitleInput(cmd.firstMessage);
		log("summarize_title: using active model=%s", model.id);
		const reply = await completeSimple(
			model,
			{
				systemPrompt: TITLE_SYSTEM_PROMPT,
				messages: [{ role: "user", content: text, timestamp: Date.now() }],
			},
			{
				apiKey: auth.apiKey,
				headers: auth.headers,
				maxTokens: 40,
				timeoutMs: 20000,
			},
		);
		const textContent = reply.content.find((c: { type: string }) => c.type === "text") as
			| { type: "text"; text: string }
			| undefined;
		if (
			!textContent ||
			reply.stopReason === "error" ||
			reply.stopReason === "aborted"
		) {
			send({
				type: "error",
				id: cmd.id,
				message: reply.errorMessage || "No title generated",
			});
			return;
		}
		const title = cleanSummaryTitle(textContent.text);
		send({ type: "result", id: cmd.id, data: { title } });
	} catch (err) {
		send({
			type: "error",
			id: cmd.id,
			message: err instanceof Error ? err.message : String(err),
		});
	}
}
