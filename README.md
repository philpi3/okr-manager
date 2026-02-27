# OKR Manager for Obsidian

Track your Objectives and Key Results directly in Obsidian. OKRs are stored as plain markdown files with YAML frontmatter — fully compatible with Dataview, search, and any other Obsidian workflow.

## Features

- **Objectives & Key Results** — create and edit OKRs through clean modal dialogs
- **Multiple cycle types** — organise OKRs by Year, Half year, Quarter, or Month, all with a structured picker (no manual typing)
- **Progress tracking** — log check-ins with a new value and note; progress is computed automatically
- **Overview board** — a full-width tab showing all OKRs as a Kanban-style board, grouped by Cycle or Owner
- **Cycle type filter** — filter the overview to show only yearly, quarterly, or monthly OKRs
- **Sidebar dashboard** — a persistent panel for quick access while working in other notes
- **Chronological sorting** — cycles sort correctly across types (monthly inside a quarter, quarters inside a year)
- **Plain markdown storage** — each objective is a `.md` file; check-ins are appended to the note body

## Installation

### From the Community Plugin browser (recommended)

1. Open **Settings → Community Plugins** and disable Safe Mode
2. Click **Browse** and search for **OKR Manager**
3. Click **Install**, then **Enable**

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Create the folder `<your-vault>/.obsidian/plugins/okr-manager/`
3. Copy the three files into that folder
4. In Obsidian go to **Settings → Community Plugins** and enable **OKR Manager**

## Usage

### Opening views

| Action | How |
|---|---|
| Open the full-width Overview board | Click the **grid icon** in the ribbon, or run **OKR Manager: Open OKR Overview** |
| Open the sidebar Dashboard | Click the **target icon** in the ribbon, or run **OKR Manager: Open OKR Dashboard (sidebar)** |

The Overview opens as a tab in the main editor area. The Dashboard opens in the right sidebar.
Both views auto-refresh whenever an OKR note is changed.

### Creating an Objective

1. Click **+ New Objective** in either view (or run **OKR Manager: New Objective**)
2. Fill in the title, cycle, owner, and status
3. Click **Create Objective**

A new markdown file is created in your OKR folder (default: `OKRs/`).

#### Choosing a cycle

The cycle picker lets you select the granularity first, then the specific period:

| Type | Example output | When to use |
|---|---|---|
| Year | `2026` | Annual company goals |
| Half year | `2026-H1` | Semi-annual planning |
| Quarter | `2026-Q2` | Standard quarterly OKRs |
| Month | `2026-03` | Short-term sprint goals |
| Custom | anything | Non-standard cadences (e.g. `2026-Sprint-3`) |

### Adding Key Results

1. Click **+ Add Key Result** at the bottom of any objective card
2. Enter a title, target number, unit (e.g. `$`, `deals`, `%`), current value, and status
3. Click **Add Key Result**

Progress (0–100%) is computed automatically as `current ÷ target`.

### Logging a Check-in

1. Click **Check-in** next to any Key Result
2. Enter the new current value and an optional note
3. Click **Log Check-in**

The KR progress updates in the frontmatter, and a check-in line is appended to the note body under `## Check-ins`.

### Overview board — grouping and filtering

**Group by:** toggle between **Cycle** (default) and **Owner** using the control in the top-right of the toolbar. Each group becomes a column.

**Filter by cycle type:** when grouped by Cycle, a filter bar appears below the toolbar:

```
Show:  [ All ]  [ Year ]  [ Quarter ]  [ Month ]
```

Only types present in your vault appear. Click a pill to show only that granularity.

## Data format

Each objective is a markdown note with YAML frontmatter:

```markdown
---
type: okr-objective
title: "Grow product revenue"
cycle: "2026-Q2"
owner: "Phil"
status: in-progress
progress: 45
key_results:
  - id: kr-1726000000000
    title: "Reach $50k MRR"
    target: 50000
    unit: "$"
    current_value: 22500
    progress: 45
    status: in-progress
---

## Check-ins

- **2026-04-15** · Reach $50k MRR → 22500 · "Closed 3 new accounts this week"
```

Supported cycle formats:

| Format | Type |
|---|---|
| `2026` | Year |
| `2026-H1`, `2026-H2` | Half year |
| `2026-Q1` … `2026-Q4` | Quarter |
| `2026-01` … `2026-12` | Month |
| Anything else | Custom |

## Settings

Go to **Settings → OKR Manager** to configure:

| Setting | Default | Description |
|---|---|---|
| OKR folder | `OKRs` | Vault folder where new objective notes are created |
| Default owner | _(empty)_ | Pre-filled owner name for new objectives |

## Development

Requirements: [Node.js](https://nodejs.org) (or Docker with the `node:24-alpine` image)

```bash
# Install dependencies
npm install

# Production build → main.js
npm run build

# Watch mode (rebuilds on save)
npm run dev
```

To test in Obsidian, copy `manifest.json`, `main.js`, and `styles.css` into:

```
<vault>/.obsidian/plugins/okr-manager/
```

## License

MIT — see [LICENSE](LICENSE)
