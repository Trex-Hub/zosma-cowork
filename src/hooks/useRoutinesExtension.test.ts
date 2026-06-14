import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...a: unknown[]) => invokeMock(...a),
}));

import { useRoutinesExtension } from "./useRoutinesExtension";

describe("useRoutinesExtension", () => {
	beforeEach(() => {
		invokeMock.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does nothing until the Tasks tab is active", () => {
		invokeMock.mockResolvedValue({ extensions: [] });
		renderHook(() => useRoutinesExtension(false));
		expect(invokeMock).not.toHaveBeenCalled();
	});

	it("goes straight to ready when pi-routines is installed + enabled", async () => {
		invokeMock.mockImplementation((cmd: string) => {
			if (cmd === "list_extensions")
				return Promise.resolve({
					extensions: [{ id: "pi-routines", name: "pi-routines", installed: true, enabled: true }],
				});
			return Promise.resolve(undefined);
		});
		const { result } = renderHook(() => useRoutinesExtension(true));
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(invokeMock).toHaveBeenCalledWith("list_extensions");
		expect(invokeMock).not.toHaveBeenCalledWith("install_extension", expect.anything());
		expect(invokeMock).not.toHaveBeenCalledWith("reload_sidecar");
	});

	it("installs, then reloads the sidecar when pi-routines is missing", async () => {
		invokeMock.mockImplementation((cmd: string) => {
			if (cmd === "list_extensions") return Promise.resolve({ extensions: [] });
			return Promise.resolve(undefined);
		});
		const { result } = renderHook(() => useRoutinesExtension(true));
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(invokeMock).toHaveBeenCalledWith("install_extension", {
			source: "pi-routines",
			refName: null,
		});
		expect(invokeMock).toHaveBeenCalledWith("reload_sidecar");
	});

	it("enables (not installs) when present but disabled", async () => {
		invokeMock.mockImplementation((cmd: string) => {
			if (cmd === "list_extensions")
				return Promise.resolve({
					extensions: [{ id: "pi-routines", name: "pi-routines", installed: true, enabled: false }],
				});
			return Promise.resolve(undefined);
		});
		const { result } = renderHook(() => useRoutinesExtension(true));
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(invokeMock).toHaveBeenCalledWith("set_extension_enabled", {
			extensionId: "pi-routines",
			enabled: true,
		});
		expect(invokeMock).not.toHaveBeenCalledWith("install_extension", expect.anything());
		expect(invokeMock).toHaveBeenCalledWith("reload_sidecar");
	});

	it("reports an error and can retry", async () => {
		invokeMock.mockImplementation((cmd: string) => {
			if (cmd === "list_extensions") return Promise.reject(new Error("offline"));
			return Promise.resolve(undefined);
		});
		const { result } = renderHook(() => useRoutinesExtension(true));
		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.error).toBe("offline");

		// retry now succeeds
		invokeMock.mockResolvedValue({
			extensions: [{ id: "pi-routines", name: "pi-routines", installed: true, enabled: true }],
		});
		result.current.retry();
		await waitFor(() => expect(result.current.status).toBe("ready"));
	});
});
