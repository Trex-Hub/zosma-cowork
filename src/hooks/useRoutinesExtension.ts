/**
 * useRoutinesExtension — ensures the `pi-routines` extension is installed &
 * enabled the first time the user opens the Tasks tab (#289).
 *
 * Tasks are powered by the pi-routines pi-extension: it gives the agent the
 * `cron_create` tool and runs the scheduler that fires tasks. It isn't part of
 * the default package set, so rather than make the user hunt for it in the
 * Extensions screen, the Tasks tab transparently installs + enables it on first
 * visit and shows a short "setting up" state while that happens.
 *
 * Bringing it online needs three steps (install/enable only mutate config):
 *   1. install_extension (if missing) — adds the npm package + registry entry.
 *   2. set_extension_enabled (if present but disabled).
 *   3. reload_sidecar — re-inits the agent so cron_create + the scheduler load
 *      into the live session. We only reload when we actually changed something,
 *      so re-opening Tasks later is a cheap no-op.
 *
 * The check runs once per app session, gated on `active` (the Tasks tab being
 * selected), so nothing is installed until the user actually wants Tasks.
 */

import type { ZemExtension } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { retryOnClosed } from "@/lib/utils";

/** npm package id of the routines/scheduler extension. */
export const ROUTINES_PKG = "pi-routines";

export type RoutinesStatus = "checking" | "installing" | "ready" | "error";

/** Does this extension entry refer to pi-routines (by id/name/source)? */
function isRoutines(e: ZemExtension): boolean {
	const hay = `${e.id ?? ""} ${e.name ?? ""} ${e.source?.value ?? ""}`.toLowerCase();
	return hay.includes(ROUTINES_PKG);
}

interface UseRoutinesExtensionReturn {
	/** Lifecycle of the ensure flow; gate the Tasks UI on `"ready"`. */
	status: RoutinesStatus;
	/** Error message when `status === "error"`. */
	error: string | null;
	/** Re-run the ensure flow (e.g. from a "Try again" button). */
	retry: () => void;
}

export function useRoutinesExtension(active: boolean): UseRoutinesExtensionReturn {
	const [status, setStatus] = useState<RoutinesStatus>("checking");
	const [error, setError] = useState<string | null>(null);
	// Guards the auto-run so we ensure at most once per app session.
	const ranRef = useRef(false);

	const ensure = useCallback(async () => {
		setError(null);
		setStatus("checking");
		try {
			const res = await retryOnClosed(() =>
				invoke<{ extensions?: ZemExtension[] } | ZemExtension[]>("list_extensions"),
			);
			const list = Array.isArray(res) ? res : (res.extensions ?? []);
			const found = list.find(isRoutines);

			const installed = !!found && found.installed !== false;
			const enabled = !!found && found.enabled !== false;
			if (installed && enabled) {
				setStatus("ready");
				return;
			}

			// Needs setup — install and/or enable, then load it into the session.
			setStatus("installing");
			if (!installed) {
				await invoke("install_extension", { source: ROUTINES_PKG, refName: null });
			} else if (!enabled && found) {
				await invoke("set_extension_enabled", { extensionId: found.id, enabled: true });
			}
			await invoke("reload_sidecar");
			setStatus("ready");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		if (!active || ranRef.current) return;
		ranRef.current = true;
		ensure();
	}, [active, ensure]);

	const retry = useCallback(() => {
		ranRef.current = true;
		ensure();
	}, [ensure]);

	return { status, error, retry };
}
