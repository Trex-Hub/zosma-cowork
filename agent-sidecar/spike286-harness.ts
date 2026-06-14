/**
 * P0 spike #286 harness — proves a pi-routines durable cron task fires into a
 * live pi 0.74.2 session via pi.sendUserMessage() and that the fired prompt
 * reaches the session's event stream (the same stream the Cowork sidecar
 * forwards to the desktop UI via `session.subscribe(...)`).
 *
 * This mirrors agent-sidecar/src/index.ts init exactly:
 *   AuthStorage -> ModelRegistry -> SettingsManager.inMemory ->
 *   DefaultResourceLoader { noExtensions:true, extensionFactories:[pi-routines] }
 *   -> createAgentSession -> session.subscribe(...)
 *
 * It then writes a `* * * * *` durable task into <cwd>/.pi/scheduled_tasks.json
 * (exactly what cron_create would persist) with nextRunAt in the immediate
 * past, so the scheduler's 1s poll fires it within ~1-2s — no minute-boundary
 * wait, fully deterministic.
 *
 * Throwaway: not shipped. Run with the worktree's symlinked node_modules:
 *   node_modules/.bin/tsx spike286-harness.ts
 */

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
	AuthStorage,
	DefaultResourceLoader,
	ModelRegistry,
	SessionManager,
	SettingsManager,
	createAgentSession,
} from "@earendil-works/pi-coding-agent";
import {
	piAgentDir,
	readPiPackages,
	resolveEnabledExtensionPaths,
	makeExtensionFactory,
} from "./src/disk-extension-loader.ts";

const log = (...a: unknown[]) => console.log("[spike]", ...a);

const CWD = "/tmp/spike286-cwd";
const RUN_TURN = process.argv.includes("--turn"); // also drive a real LLM turn

async function main() {
	// Isolated, stable cwd for the lock + task file.
	rmSync(join(CWD, ".pi"), { recursive: true, force: true });
	mkdirSync(CWD, { recursive: true });

	const piDir = piAgentDir();
	const authStorage = AuthStorage.create(join(piDir, "auth.json"));
	const modelRegistry = ModelRegistry.create(
		authStorage,
		join(piDir, "models.json"),
	);
	const settingsManager = SettingsManager.inMemory({});
	// Mirror the sidecar: share pi's installed packages so the resolver finds
	// npm: extensions (incl. pi-routines) exactly as index.ts does.
	const piPackages = readPiPackages(piDir);
	if (piPackages.length > 0) settingsManager.setPackages(piPackages);

	// Resolve ONLY pi-routines from pi's installed packages (same loader the
	// sidecar uses), so the spike is isolated from the other 12 extensions.
	const paths = await resolveEnabledExtensionPaths({
		cwd: CWD,
		agentDir: piDir,
		settingsManager,
	});
	const routinesPath = paths.find((p) => p.includes("pi-routines"));
	if (!routinesPath) {
		throw new Error(
			`pi-routines not resolved from settings.json packages. Resolved:\n${paths.join("\n")}`,
		);
	}
	log("pi-routines entry:", routinesPath);

	const loader = new DefaultResourceLoader({
		cwd: CWD,
		agentDir: piDir,
		settingsManager,
		noExtensions: true,
		extensionFactories: [makeExtensionFactory(routinesPath)],
	});
	await loader.reload();
	const extResult = loader.getExtensions();
	for (const e of extResult.errors ?? [])
		log("EXTENSION LOAD ERROR:", e.path, e.error);
	log(
		"extensions loaded:",
		extResult.extensions?.length ?? 0,
		"errors:",
		extResult.errors?.length ?? 0,
	);

	const { session } = await createAgentSession({
		cwd: CWD,
		authStorage,
		modelRegistry,
		sessionManager: SessionManager.inMemory(CWD),
		settingsManager,
		resourceLoader: loader,
	});

	// Deliver session_start to the extensions (the sidecar does this via
	// bindExtensionUi -> session.bindExtensions). This is what starts the
	// pi-routines scheduler. Minimal no-op uiContext (ctx.hasUI true).
	await session.bindExtensions({
		uiContext: {
			select: async () => undefined,
			confirm: async () => false,
			input: async () => undefined,
			notify: (m: string, t?: string) => log(`ui.notify[${t}]: ${m}`),
		} as never,
	});
	log("bindExtensions done -> session_start delivered, scheduler should start");

	// Capture EVERY event the sidecar would forward to the desktop UI.
	const seen: string[] = [];
	let firedUserMessageText: string | null = null;
	let assistantReply: string | null = null;
	session.subscribe((event: { type: string; [k: string]: unknown }) => {
		seen.push(event.type);
		// Capture the assistant's reply text from a completed assistant message.
		if (event.type === "message_end") {
			const msg = (event as { message?: { role?: string; content?: unknown } })
				.message;
			if (msg?.role === "assistant" && assistantReply === null) {
				assistantReply = JSON.stringify(msg.content).slice(0, 300);
			}
		}
		// The fired prompt enters as a user message. Detect whichever shape pi
		// 0.74.2 uses to surface user input on the event stream.
		const blob = JSON.stringify(event);
		if (
			firedUserMessageText === null &&
			blob.includes("Scheduled task fired: spike")
		) {
			firedUserMessageText = blob.slice(0, 400);
			log("⏰ FIRED user message observed on event stream:");
			log("   event.type =", event.type);
			log("   payload ~=", firedUserMessageText);
		}
	});

	// session_start must be delivered so pi-routines starts its scheduler.
	// createAgentSession fires session_start during construction; if the
	// scheduler isn't up yet, give the extension a tick.
	await new Promise((r) => setTimeout(r, 250));

	// Write the durable task EXACTLY as cron_create would, with nextRunAt in the
	// immediate past so the 1s poll fires it right away.
	const now = Date.now();
	const taskFile = join(CWD, ".pi", "scheduled_tasks.json");
	mkdirSync(join(CWD, ".pi"), { recursive: true });
	const iso = new Date().toISOString();
	writeFileSync(
		taskFile,
		JSON.stringify(
			{
				version: 1,
				tasks: [
					{
						id: `task_${now}_spike0`,
						name: "spike",
						schedule: "* * * * *",
						prompt: `say SPIKE OK ${iso}`,
						type: "durable",
						createdAt: iso,
						recurring: true,
						maxAgeDays: 7,
						// 5s in the past -> fires on the next poll tick (<=1s).
						nextRunAt: new Date(now - 5000).toISOString(),
					},
				],
			},
			null,
			2,
		),
	);
	log("wrote durable task ->", taskFile);

	// Wait up to ~8s for the scheduler poll to fire it.
	const deadline = Date.now() + 8000;
	while (Date.now() < deadline && firedUserMessageText === null) {
		await new Promise((r) => setTimeout(r, 250));
	}

	if (firedUserMessageText === null) {
		log("❌ task did NOT fire within 8s. Event types seen:", uniq(seen));
		process.exit(2);
	}

	log("✅ durable task fired via pi.sendUserMessage and reached the session.");
	log("event types seen so far:", uniq(seen));

	if (RUN_TURN) {
		// Let the triggered turn run to completion to prove the agent responds
		// (the fire calls session.prompt internally; we just wait for idle).
		log("waiting for the triggered turn to complete (real LLM)…");
		const turnDeadline = Date.now() + 90000;
		while (Date.now() < turnDeadline && assistantReply === null) {
			await new Promise((r) => setTimeout(r, 500));
		}
		log("post-turn event types:", uniq(seen));
		if (assistantReply)
			log("🤖 agent responded:", assistantReply);
		else log("⚠️ no assistant reply captured within 90s");
	}

	// Cleanup: remove the test task + lock.
	rmSync(join(CWD, ".pi"), { recursive: true, force: true });
	log("cleaned up .pi task/lock files.");
	process.exit(0);
}

function uniq(a: string[]): string[] {
	return [...new Set(a)];
}

main().catch((err) => {
	console.error("[spike] FATAL:", err);
	process.exit(1);
});
