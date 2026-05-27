# Zosma Cowork 🇮🇳

**English** | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> A desktop coworker built on [pi](https://github.com/earendil-works/pi-coding-agent) — the minimal agentic work harness. Streaming, thinking, tool calls, multi-turn sessions — all free, all open-source, all local.
>
> Zosma Cowork brings the full [pi extension ecosystem](https://github.com/earendil-works/pi-coding-agent) into a native desktop app. Just bring your own API key or use local models.
>
> **Made with ❤️ by [Zosma AI](https://zosma.ai) in India 🇮🇳**

## Gallery

<img src="./assets/demo.gif" width="100%" alt="Zosma Cowork demo" />

<img src="./assets/screenshot.png" width="100%" alt="Zosma Cowork screenshot" />

*Invoice processing with natural language agents. See more demos at [zosma.ai/zosma-cowork/gallery](https://www.zosma.ai/zosma-cowork/gallery)*

## Installation

### macOS

**Homebrew (recommended):**
```bash
brew tap zosmaai/tap
brew install --cask zosma-cowork
```

> **Note:** If macOS Gatekeeper blocks the app, use `--no-quarantine`:
> ```bash
> brew install --cask --no-quarantine zosma-cowork
> ```
> Zosma Cowork is open-source and not yet signed with an Apple Developer certificate. [Code signing is planned.](https://github.com/zosmaai/zosma-cowork/issues)

**Direct download:** Grab the latest `.dmg` from the [Releases page](https://github.com/zosmaai/zosma-cowork/releases/latest).

### Windows

Download and run the installer from the [Releases page](https://github.com/zosmaai/zosma-cowork/releases/latest):

| File | Description |
|------|-------------|
| `zosma-cowork_x64-setup.exe` | Inno Setup installer |
| `zosma-cowork_x64_en-US.msi` | Windows Installer package |

### Linux

| Distribution | Format | Install |
|-------------|--------|---------|
| Debian / Ubuntu | `.deb` | `sudo dpkg -i zosma-cowork_*_amd64.deb` |
| Fedora / RHEL | `.rpm` | `sudo rpm -i zosma-cowork-*.x86_64.rpm` |
| Any distro | `.AppImage` | `chmod +x *.AppImage && ./zosma-cowork_*_amd64.AppImage` |

Download the latest package from the [Releases page](https://github.com/zosmaai/zosma-cowork/releases/latest).

### Build from source

See [Development](#development) below.

## Why Zosma Cowork?

### 🌟 A Desktop Coworker Built on pi

Zosma Cowork is a desktop application built on [pi](https://github.com/earendil-works/pi-coding-agent) — the minimal, language-agnostic coding agent harness. pi's philosophy of simplicity and composability carries directly into your desktop experience. Every pi extension works out of the box, with zero wrappers or adapters.

### 🆓 Free & Open Source

Zosma Cowork is **100% free and open-source** (MIT). Bring your own API key or run local models — you control the costs.

### 🧩 Full pi Extension Ecosystem

The [pi ecosystem](https://github.com/earendil-works/pi-coding-agent) includes hundreds of extensions, skills, tools, prompts, and themes — all compatible with Zosma Cowork. Plug them into your `~/.zosmaai/cowork/` directory and they just work. No wrapping, no porting, no lock-in.

### 👥 For Non-Technical Users

Zosma Cowork is designed to be the tool you set up for:
- **Your friend** who wants to use AI but doesn't know where to start
- **Your colleague** on the business side who needs AI assistance without a terminal
- **Your team members** who want to try agentic AI

**This is why Indian developers should contribute.** Not because you need another tool — but because your non-technical friends, colleagues, and community members need a free, simple on-ramp into the agentic AI world.

> *"India doesn't just consume technology — we build it, we ship it, we lead it. And we make sure nobody gets left behind."

## Features

- **Node.js agent sidecar** — The pi-mono TypeScript SDK runs in a managed sidecar process for full agent capabilities (extensions, tools, providers)
- **Thin Tauri relay** — The Rust layer is a minimal IPC bridge between React and the sidecar, keeping the native desktop shell lightweight
- **pi extension ecosystem** — Compatible with pi extensions via `DefaultResourceLoader` — skills, tools, and prompts auto-discovered from `~/.zosmaai/cowork/`
- **Multi-turn sessions** — Full conversation continuity with persistent session history
- **Streaming responses** — See the agent think, write, and call tools in real-time
- **Thinking blocks** — Expandable reasoning from the model
- **Tool call timeline** — Live bash/edit/write tool calls with args and results
- **Session management** — Persistent chat sessions saved to `~/.zosmaai/cowork/`
- **Light & dark mode** — Warm cream light mode, warm charcoal dark mode
- **Keyboard shortcuts** — `Cmd/Ctrl+Shift+K` to focus, `Cmd/Ctrl+N` for new session
- **Abort & steering** — Stop a running agent mid-turn, send follow-up steering messages
- **Claude-inspired UI** — 3-column layout with sidebar, workspace, and info panel

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Tauri v2 Desktop Shell (Rust — thin relay)                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Left Sidebar   │  │  Center Workspace│  │Right Panel │  │
│  │  (Sessions)     │  │  (Chat/Welcome)  │  │(Progress)  │  │
│  └─────────────────┘  └──────────────────┘  └────────────┘  │
│           ▲ React + Tailwind CSS v4                         │
│           │                                                  │
│  ┌────────┴─────────────────────────────────────────────┐   │
│  │  Tauri IPC Commands                                   │   │
│  │  get_models · send_prompt · abort · set_model         │   │
│  │  save_auth · has_credentials · reload                  │   │
│  └────────────┬───────────────────────────┬──────────────┘   │
└───────────────┼───────────────────────────┼──────────────────┘
                │  stdin/stdout JSON lines   │
┌───────────────┼───────────────────────────┼──────────────────┐
│  Agent Sidecar (Node.js)                  │                  │
│  ┌──────────┴──────────────────────────┐ │                  │
│  │  pi-mono SDK (@earendil-works/pi)   │ │                  │
│  │  • AuthStorage — API keys           │ │                  │
│  │  • ModelRegistry — model discovery  │ │                  │
│  │  • SessionManager — conversation    │ │                  │
│  │  • DefaultResourceLoader            │ │                  │
│  │    → extensions, skills, prompts    │ │                  │
│  └──────────┬──────────────────────────┘ │                  │
│             │                              │                  │
│       LLM Providers                        │                  │
│  (OpenAI, Anthropic, Google, ...)          │                  │
└─────────────────────────────────────────────┘                  │
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Desktop Shell | Tauri v2, Rust, Tokio |
| Agent Engine | Node.js sidecar using `@earendil-works/pi-coding-agent` (pi-mono SDK) |
| Testing | Vitest, Testing Library, jsdom |
| Linting | Biome (frontend + sidecar), Clippy (Tauri relay) |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+ (for Tauri desktop shell)

### Quick Start

```bash
# Install frontend dependencies
npm install

# Install agent-sidecar dependencies
cd agent-sidecar && npm install && cd ..

# Run frontend dev server
npm run dev:frontend

# Run full Tauri app (frontend + Rust relay + Node.js sidecar)
npm run dev
```

### Scripts

```bash
# Frontend
npm run lint          # Biome lint
npm run typecheck     # TypeScript check
npm run test          # Vitest run
npm run validate      # lint + typecheck + test
npm run format        # Biome format

# Tauri
npm run build:frontend
npm run build         # Build release binary

# Agent Sidecar
cd agent-sidecar
npm run build         # TypeScript → JavaScript
npm run dev           # tsx watch (standalone development)

# Rust (Tauri relay only)
cargo fmt --all --check
cargo clippy --workspace -- -D warnings
```

## Config & Data

| What | Location | Notes |
|------|----------|-------|
| LLM providers & API keys | `~/.zosmaai/cowork/auth.json` | Managed by the app |
| Model definitions | `~/.zosmaai/cowork/models.json` | Managed by the app |
| Extensions & skills | `~/.zosmaai/cowork/extensions/` | Pi-compatible extensions |
| Session history | `~/.zosmaai/cowork/` | Managed by Zosma Cowork |

## IPC Protocol

The Tauri relay communicates with the Node.js sidecar via stdin/stdout JSON lines:

**Commands (→ sidecar):**

| Command | Description |
|---------|-------------|
| `init` | Initialize agent with zosmaDir config |
| `get_models` | List available models from all providers |
| `prompt` | Send user message, stream events |
| `abort` | Cancel running prompt |
| `set_model` | Switch active model |
| `save_auth` | Save API key for a provider |
| `reload` | Reinitialize with fresh extensions/auth |

**Events (← sidecar):**

| Event | UI Effect |
|-------|-----------|
| `ready` | Models loaded, enable UI |
| `event` | Agent session events (thinking, text, tool calls) |
| `done` | Prompt completed |
| `result` | Response to a request command |
| `error` | Error with message |

## Project Structure

```
zosma-cowork/
├── agent-sidecar/                # Node.js agent process
│   └── src/
│       └── index.ts              # Sidecar: pi-mono SDK, stdin/stdout protocol
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── ChatMessage.tsx       # Message with thinking + tool calls
│   │   ├── ThinkingBlock.tsx     # Expandable reasoning
│   │   ├── ToolCallTimeline.tsx  # Tool execution timeline
│   │   ├── MessageInput.tsx      # Chat input
│   │   └── ui/                   # Primitives (tooltip, badge, etc.)
│   ├── hooks/
│   │   ├── usePiStream.ts        # Streaming state machine (useReducer)
│   │   └── useSessions.ts        # Session persistence
│   ├── types/
│   │   ├── index.ts              # ChatMessage, ToolCallInfo
│   │   └── pi-events.ts          # CoworkEvent types
│   ├── App.tsx                   # Main 3-column layout
│   └── App.css                   # Tailwind theme (light + dark)
├── src-tauri/                    # Tauri desktop shell (thin Rust relay)
│   └── src/
│       ├── main.rs               # Entry point
│       └── lib.rs                # IPC commands → sidecar process
├── docs/                         # Architecture & plans
└── .github/workflows/            # CI/CD
```

## 🇮🇳 Made in India

**Zosma Cowork** is built **from India** by **ZOSMAAI SOLUTIONS PRIVATE LIMITED**.

> *"India doesn't just consume technology — we build it, we ship it, we lead it."*

## License

MIT © [Zosma AI](https://zosma.ai)
