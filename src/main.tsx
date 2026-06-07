import { reactErrorHandler } from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App";
import { initChatWidth } from "./lib/chat-width";
import { initTheme } from "./lib/themes";

// Apply saved dark/light preference before rendering to avoid flash
initTheme();
// Apply saved chat content width (sets --chat-max-width)
initChatWidth();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
createRoot(rootElement, {
	onUncaughtError: reactErrorHandler(),
	onCaughtError: reactErrorHandler(),
	onRecoverableError: reactErrorHandler(),
}).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
