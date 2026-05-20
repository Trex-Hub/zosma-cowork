# Office Document Generation

Generate professional-grade DOCX, PPTX, and XLSX files using the `officecli` binary.
This skill teaches you (the agent) how to produce human-quality Office documents.

## When to activate

Trigger this skill when the user says anything like:
- "Create a pitch deck / presentation / slides"
- "Generate a report / proposal / document"
- "Make a spreadsheet / budget / financial model"
- "Create a document / docx / pptx / xlsx file"
- "Edit this document / slide / sheet"

## Available Tools

You have 8 tools at your disposal:

| Tool | Purpose |
|------|---------|
| `create_document` | Create blank DOCX/PPTX/XLSX |
| `add_element` | Add slides, paragraphs, tables, charts, shapes |
| `set_element` | Update properties & text of existing elements |
| `remove_element` | Delete slides, sections, or elements |
| `read_document` | Inspect: outline, text, html, annotated, issues, structure |
| `validate_document` | Check against OpenXML schema |
| `batch_edit` | Multiple edits in one save cycle (preferred for efficiency) |
| `preview_document` | Live browser preview for visual QA |

## Workflow: Multi-Step Document Generation

For every document request, follow this workflow:

```
PLAN → CREATE → BUILD → FORMAT → REVIEW → FIX → DELIVER
```

### Step 1: Plan
1. Understand the document type (deck, report, spreadsheet)
2. Outline the structure (number of slides/sections, key data points)
3. Choose a color scheme and font pair from the Design Rules below
4. Confirm the plan with the user before starting

### Step 2: Create
```tool_call
create_document({ path: "deck.pptx", type: "pptx" })
```

### Step 3: Build
For PPTX — add slides one by one:
```tool_call
add_element({
  path: "deck.pptx",
  domPath: "/slide[last]",
  element: "slide",
  properties: { layout: "title" }
})
```

For DOCX — build paragraphs and sections:
```tool_call
add_element({
  path: "report.docx",
  domPath: "/document/body/p[last]",
  element: "paragraph",
  content: "Executive Summary"
})
```

For XLSX — add sheets and populate:
```tool_call
add_element({
  path: "budget.xlsx",
  domPath: "/sheet[1]/row[2]/cell[1]",
  element: "cell",
  content: "Revenue"
})
```

### Step 4: Format
Apply styling via `batch_edit` (preferred) or individual `set_element` calls.

### Step 5: Review
```tool_call
read_document({ path: "deck.pptx", mode: "outline" })
read_document({ path: "deck.pptx", mode: "issues" })
validate_document({ path: "deck.pptx" })
```

### Step 6: Fix
Address any issues found in review. Re-validate after fixing.

### Step 7: Deliver
Present the final file path to the user with a summary.

---

## Design Rules

### Color Palettes

#### Palette 1: Professional Navy (default for business)
- Primary: `#1B3A5C` (dark navy)
- Accent: `#0078D4` (Microsoft blue)
- Background: `#FFFFFF` (white)
- Text: `#333333` (dark gray)
- Light accent: `#E8EFF7` (light blue-gray)
- Success: `#107C10` (green)

#### Palette 2: Startup Vibrant (for pitch decks)
- Primary: `#0F172A` (slate 900)
- Accent: `#6366F1` (indigo 500)
- Background: `#FFFFFF`
- Text: `#1E293B` (slate 800)
- Light accent: `#EEF2FF` (indigo 50)
- Success: `#10B981` (emerald)

#### Palette 3: Minimal Clean (for reports)
- Primary: `#1E1E1E`
- Accent: `#2563EB` (blue 600)
- Background: `#FAFAFA`
- Text: `#333333`
- Light accent: `#F1F5F9` (slate 100)
- Success: `#059669` (emerald 600)

#### Palette 4: Academic (for papers)
- Primary: `#1A1A2E`
- Accent: `#8B5CF6` (violet 600)
- Background: `#FFFFFF`
- Text: `#2D2D2D`
- Light accent: `#F5F3FF` (violet 50)
- Success: `#7C3AED` (violet 500)

### Typography

#### For PPTX (presentations)
- Slide titles: 36–44pt, bold, primary color
- Slide subtitles: 18–24pt, medium weight, accent color
- Body text: 14–16pt, regular weight, text color
- Bullet text: 12–14pt
- Speaker notes: 10–12pt, italic

#### For DOCX (documents)
- Title (center): 26pt, bold
- Heading 1: 20pt, bold, primary color
- Heading 2: 16pt, bold, text color
- Heading 3: 14pt, bold italic
- Body text: 11pt, regular, 1.15 line spacing
- Captions: 10pt, italic, light accent color

#### For XLSX (spreadsheets)
- Header row: 12pt, bold, white text on primary background
- Data cells: 11pt, regular
- Totals: 11pt, bold
- Charts: title 14pt bold, labels 10pt

### Font Pairs
- **Business**: Arial (headings) + Arial (body) — safe, universal
- **Modern**: Inter (headings) + Inter (body) — clean, startuppy
- **Academic**: Times New Roman (headings) + Times New Roman (body)
- **Proposal**: Calibri (headings) + Calibri (body) — professional, default

### Layout Rules

#### PPTX
- Slide backgrounds: white or light gradient (never dark unless night mode)
- 0.5-inch margins on all sides
- Consistent 0.3–0.5-inch gaps between elements
- Vary layouts: title slide → section divider → content → full bleed
- Max 6 bullet points per slide
- One key message per slide
- Charts and images should occupy at least 40% of slide area
- Use section dividers between major topics

#### DOCX
- 1-inch margins
- First-line indent for paragraphs (0.5 inch)
- Page numbers in footer (bottom-center)
- Table of contents for documents > 3 pages
- Section breaks between major chapters
- Consistent heading hierarchy (no skipping levels)

#### XLSX
- Freeze header row
- Alternating row colors for readability
- Bold totals row
- Currency formatting for financial columns
- Percentage formatting for ratios
- Number formatting with 2 decimal places

---

## Quality Assurance

### Before delivering, ALWAYS run:
1. `validate_document` — check schema compliance
2. `read_document(mode: "issues")` — detect formatting/structure problems
3. `read_document(mode: "html")` — visual inspection (if browser available)

### Quality checklist:
- [ ] No overlapping elements (PPTX)
- [ ] Consistent font usage throughout
- [ ] Colors match the chosen palette
- [ ] No text overflow / clipped content
- [ ] Proper heading hierarchy (DOCX)
- [ ] Frozen header row (XLSX)
- [ ] Charts have titles and labels
- [ ] All slides have titles (PPTX)

### If issues found:
1. Fix priority: schema errors > formatting issues > content warnings
2. Re-validate after fixes
3. Max 3 fix cycles before asking user

---

## Template Reference

### Startup Pitch Deck (12 slides)
1. Title slide (company name + tagline)
2. Problem (the pain point)
3. Solution (your product)
4. How It Works (architecture/flow)
5. Market Opportunity (TAM/SAM/SOM chart)
6. Business Model (revenue model)
7. Traction (growth chart)
8. Competitive Landscape (comparison table)
9. Team (founder bios)
10. Financial Projections (revenue chart)
11. Ask (funding amount + use of funds)
12. Thank You (contact info)

### Business Report (8-10 pages)
1. Cover page
2. Executive Summary
3. Table of Contents
4. Introduction / Background
5. Analysis (with charts and tables)
6. Findings
7. Recommendations
8. Conclusion
9. Appendix (optional)

### Technical Proposal (6-8 pages)
1. Cover page
2. Executive Summary
3. Technical Approach
4. Implementation Plan
5. Timeline / Milestones
6. Budget / Resources
7. Team Qualifications
8. Terms & Conditions

---

## Notes

- All documents are created locally — no data leaves your machine
- OfficeCLI must be installed (auto-downloaded on first use)
- For batch operations, prefer `batch_edit` over individual calls
- Use `preview_document` for real-time visual feedback
- The `read_document(mode: "structure")` command shows the full DOM tree
