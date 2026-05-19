# Office Document Generation — Shipping Plan

> **Goal:** Make it trivially easy for any Zosma Cowork user to say "Create a pitch deck" or "Generate a quarterly report" and get a professional Office document back in seconds.

---

## The Architecture at a Glance

```
User says: "Create a pitch deck for my AI startup"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Zosma Cowork Agent                        │
│                                                              │
│  1. Agent receives request                                    │
│  2. Agent loads office-docs skill → learns design rules       │
│  3. Agent calls OfficeCLI tools (via pi tools)                │
│  4. Agent previews via `officecli watch` → QA loop            │
│  5. Agent presents final file path to user                    │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  OfficeCLI (single binary, no Office installed needed)       │
│                                                              │
│  create → officecli create deck.pptx                         │
│  add    → officecli add deck.pptx /slide[1] --shape ...      │
│  set    → officecli set deck.pptx / --prop color=...         │
│  view   → officecli view deck.pptx html --browser            │
│  batch  → officecli batch deck.pptx < batch.json             │
│  validate → officecli validate deck.pptx                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚢 How We Ship This (Phased)

### Phase A: Foundation (Week 1) — "It Works"

**Pri 1 — OfficeCLI auto-install**
- On first document-related request, the agent checks `which officecli`
- If missing → download binary to `~/.zosmaai/cowork/bin/officecli`
- Onboarding flow includes an "Office Document Creation" toggle (optional install)
- Binary is cached; auto-update check on startup

**Pri 2 — Pi tool wrappers in the sidecar**
- One pi extension: `@zosmaai/zosma-office-docs`
- Registers 8 tools:
  | Tool | Maps to | Description |
  |------|---------|-------------|
  | `create_document` | `officecli create <path>` | Create blank DOCX/PPTX/XLSX |
  | `add_element` | `officecli add <path> <dom-path>` | Add slides, shapes, paragraphs |
  | `set_element` | `officecli set <path> <dom-path>` | Format text, resize, recolor |
  | `remove_element` | `officecli remove <path> <dom-path>` | Delete elements |
  | `read_document` | `officecli view <path> <mode>` | Read as outline/text/issues/HTML |
  | `batch_edit` | `officecli batch <path> < batch.json` | Multiple edits, one save |
  | `preview_document` | `officecli watch <path> --browser` | Live preview in browser |
  | `validate_document` | `officecli validate <path>` | OpenXML schema check |

**Pri 3 — Skill file with design rules**
- `~/.zosmaai/cowork/skills/office-docs/SKILL.md`
- Contains: color palettes, typography pairs, layout variation rules, table/chart styling guides
- Agent loads this skill when it detects a document-related request
- Pulls from the 4 template packs defined in the roadmap

**Pri 4 — Agent prompt augmentation**
- When office-docs skill is active, inject a "Document Generation" capability block
- Multi-step workflow: **Plan → Create → Build → Format → Review → Fix → Deliver**
- The agent knows to:
  1. First plan the document structure (number of slides, sections, data tables)
  2. Create the file
  3. Build content element by element
  4. Apply design rules
  5. Preview and detect issues
  6. Fix any problems
  7. Present final path

### Phase B: UX Polish (Week 2) — "It Looks Good"

**Pri 5 — Documents right-panel section**
- "Documents" tab in the right panel (alongside Tasks, Context, Artifacts)
- Shows: recent documents created in the current session
- Preview thumbnails rendered via `officecli view <path> html`
- Quick actions: "Open file", "Share", "Export as PDF"
- Status badges: generating, ready, has-issues

**Pri 6 — Template packs**
- 4 built-in template packs shipped as JSON configs:
  - 🚀 **Startup Pitch**: 12-slide deck + executive summary (DOCX) + financial model (XLSX)
  - 📊 **Business Report**: Quarterly review (PPTX) + full report (DOCX) + data appendix (XLSX)
  - 📝 **Proposal**: Technical proposal (DOCX) + scope overview (PPTX) + budget (XLSX)
  - 📐 **Academic**: Paper template (DOCX) + presentation (PPTX)
- Each template defines: slide structure, layout rules, color scheme, font pairs
- User says "create a pitch deck" → agent loads the Startup Pitch template rules

**Pri 7 — QA loop (subagent-driven)**
- After building a document, the agent runs a QA subagent:
  1. `read_document --mode issues` → detect formatting/schema problems
  2. `read_document --mode html` → render and inspect visually
  3. `validate_document` → check OpenXML schema compliance
  4. If issues found → fix cycle (up to 3 retries)
- For PPTX: special layout checker (varied layouts, consistent spacing, color harmony)

### Phase C: Power User (Week 3) — "It's Fast"

**Pri 8 — Drag-and-drop file support**
- Drop an existing DOCX/PPTX/XLSX into the composer
- OfficeCLI reads it → agent understands structure and can edit it
- "Take this deck and update the Q3 numbers from this CSV"

**Pri 9 — Batch document generation**
- "Generate quarterly reports for all 4 regions, using the same template"
- Agent creates 4 documents in parallel using OfficeCLI batch mode
- Each customized with region-specific data

**Pri 10 — Document templates saved as "Cowork Apps"**
- Users save a document as a reusable app:
  ```
  {
    "type": "cowork-app",
    "name": "Weekly Standup Report",
    "schedule": "0 9 * * 1",
    "template": "business-report",
    "data": {
      "ticker": "{{Ticker}}",
      "week": "{{current_week}}"
    }
  }
  ```
- Weekly standup report auto-generates and saves to the user's Drive

---

## What the User Sees

### Chat-based (simplest — works Day 1)

```
User: "Create a pitch deck for my AI startup called 'NovaAI'"

Agent: [creates deck.pptx, builds slides one by one]
        [previews, fixes spacing issues]
        
✅ Done! Here's your pitch deck: ~/Documents/deck.pptx
  
  Summary:
  - 12 slides covering problem, solution, market, traction, team, financials
  - Dark navy theme with teal accents
  - 3 charts (market size, revenue projection, user growth)
  - Speaker notes on each slide
  
  Open it in PowerPoint or use `/docs preview deck.pptx` to see it here.
```

### Voice-based (ideal for founders)

```
User [voice]: "Generate a quarterly report from last quarter's data"
Agent: "I'll pull the data from your connected Google Sheets and build it."
       [works in background while user continues chatting]
       "Done. 8-page report with charts. It's in your Reports folder."
```

### Document tab (visible in right panel)

```
┌──────────────────────────────────┐
│  📄 Documents                    │
│                                  │
│  deck.pptx          ✓ Ready     │
│  ├─ 12 slides                   │
│  ├─ Dark navy theme             │
│  └─ ✅ Validated                │
│                                  │
│  Q3-Report.docx     ⟳ Building │
│  ├─ Section 4/8 complete        │
│  └─ Currently: Adding charts    │
│                                  │
│  [New Document] [Open Folder]    │
└──────────────────────────────────┘
```

---

## Technical Implementation Details

### A. The pi Extension (`@zosmaai/zosma-office-docs`)

Create a pi extension at `extensions/zosma-office-docs/`:

```
zosma-office-docs/
├── package.json       # pi extension manifest
├── index.ts           # Tool definitions + OfficeCLI binary resolver
├── tools/
│   ├── create.ts      # create_document
│   ├── edit.ts        # add_element, set_element, remove_element
│   ├── read.ts        # read_document, validate_document
│   ├── batch.ts       # batch_edit
│   └── preview.ts     # preview_document
├── design-rules/
│   ├── pitch-deck.md
│   ├── business-report.md
│   ├── proposal.md
│   └── academic.md
└── SKILL.md           # Agent prompt augmentation
```

The extension's `index.ts` registers tools using pi's Tool interface:

```typescript
import { Tool } from "@earendil-works/pi-coding-agent";

export const createDocument: Tool = {
  name: "create_document",
  description: "Create a new Office document (DOCX, PPTX, XLSX)",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Output file path" },
      type: { type: "string", enum: ["docx", "pptx", "xlsx"], description: "Document type" },
    },
    required: ["path", "type"],
  },
  execute: async ({ path, type }) => {
    // Resolve officecli binary path
    // Execute: officecli create <path>
    // Return file path + basic info
  },
};
```

### B. OfficeCLI Binary Resolution

```typescript
function resolveOfficeCLI(): string {
  // Priority:
  // 1. ~/.zosmaai/cowork/bin/officecli
  // 2. PATH (which officecli)
  // 3. Bundled with Zosma Cowork (future)
  
  const bundled = join(zosmaDir, "cowork", "bin", "officecli");
  if (existsSync(bundled)) return bundled;
  
  try {
    return execSync("which officecli", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error("OfficeCLI not found. Install with: `officecli install`");
  }
}
```

### C. Tool Registration in the Sidecar

The extension is auto-discovered by `DefaultResourceLoader` (same as other pi extensions). The user installs it once via the Extensions panel and it's available to every session.

Alternatively, for Phase A simplicity, tools can be registered directly in the sidecar (hardcoded in `index.ts`) without a separate extension install step. This is faster to ship and can be refactored into a proper extension later.

### D. Skill File Integration

The `office-docs` skill (loaded via the existing skills system) tells the agent:

1. **When to use it**: Document-related requests ("create a deck", "generate a report", "edit this docx")
2. **Which tools to use**: Maps natural language to OfficeCLI operations
3. **Design rules**: The color palettes, typography, layout rules
4. **Quality standards**: Validation before delivery, QA loop

---

## How Users Discover This

### In-product, no manual config needed

1. User opens Zosma Cowork
2. User types OR speaks: "Create a pitch deck"
3. Agent says: "I need OfficeCLI to create documents. Install it?"
4. User clicks "Install" (one click — agent downloads binary automatically)
5. Agent proceeds to create the deck

### Settings page

The Documents section in Settings shows:
- ✅ OfficeCLI installed (v2.1.0) — Update available
- Templates: Startup Pitch (installed), Business Report (installed)
- Storage: ~/Documents/Zosma/ (configurable)
- Default format: .pptx

### Extension panel

`@zosmaai/zosma-office-docs` appears in the Extensions list with:
- Toggle on/off
- Version info
- Config: default output format, default template, auto-validate toggle

---

## Key Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Bundle OfficeCLI or auto-install? | **Auto-install on first use** | Smaller download, always latest version, respects user's choice |
| Tools in sidecar or separate extension? | **Start in sidecar (Phase A), extract to extension later** | Faster to ship, no extension install step needed. Refactor when extension system is mature |
| Skill file or prompt augmentation? | **Both** | Skill provides structured rules for the agent; prompt augmentation sets context for the specific session |
| Templates as JSON or markdown? | **JSON schema** + **markdown rules** | JSON for structure (slides, sections, placeholders), markdown for design guidance (human and AI readable) |
| QA loop in agent or separate subagent? | **Subagent** | Keeps the main agent focused on content; QA subagent has specialized vision for layout checking |
| Support Google Docs too? | **No (Phase A)** | Focus on Office OpenXML (DOCX/PPTX/XLSX) first. Google Docs via existing pi-gdocs extension as a separate experience |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first document | <30 seconds from request | Agent telemetry |
| Documents passing validation | >95% | OfficeCLI validate output |
| User satisfaction | "Looks professional" on first try | Follow-up prompt ("Happy with the result?") |
| Design rule compliance | >90% for color/typography/spacing | QA subagent scores |
| No manual edits needed | >80% of documents | User doesn't ask for "make it look better" |

---

## What NOT to Build (Phase A)

- **Not** a WYSIWYG document editor inside Zosma Cowork (use Office or Google Docs for that)
- **Not** real-time collaborative editing
- **Not** DOCX → PDF conversion (OfficeCLI may add this, but not our problem)
- **Not** Google Docs/Sheets/Slides import/export (separate feature)
- **Not** Email attachments (separate feature — send via Gmail extension)
- **Not** Charts from live data sources (start with static charts, live data in Phase C)
