import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type OkrPlugin from '../main';
import { Objective } from '../types';
import { ObjectiveModal } from '../modals/objective-modal';
import { KrModal } from '../modals/kr-modal';
import { CheckInModal } from '../modals/checkin-modal';
import { parseCycle, CycleType, CYCLE_TYPE_LABELS } from '../cycle-parser';

export const OKR_OVERVIEW_VIEW_TYPE = 'okr-overview';

type GroupBy = 'cycle' | 'owner';

export class OkrOverviewView extends ItemView {
	private plugin: OkrPlugin;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	private groupBy: GroupBy = 'cycle';
	private cycleTypeFilter: CycleType | 'all' = 'all';

	constructor(leaf: WorkspaceLeaf, plugin: OkrPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return OKR_OVERVIEW_VIEW_TYPE; }
	getDisplayText(): string { return 'OKR overview'; }
	getIcon(): string { return 'layout-grid'; }

	async onOpen() {
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) return;
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.type === 'okr-objective') this.scheduleRefresh();
			})
		);
		this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
		await this.render();
	}

	onClose(): Promise<void> {
		if (this.refreshTimeout !== null) clearTimeout(this.refreshTimeout);
		return Promise.resolve();
	}

	private scheduleRefresh() {
		if (this.refreshTimeout !== null) clearTimeout(this.refreshTimeout);
		this.refreshTimeout = setTimeout(() => { void this.render(); this.refreshTimeout = null; }, 300);
	}

	render() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('okr-overview-root');

		const allObjectives = this.plugin.manager.getAllObjectives();

		// ── Stats bar ──────────────────────────────────────────────
		this.renderStats(root.createDiv({ cls: 'okr-ov-stats' }), allObjectives);

		// ── Toolbar ────────────────────────────────────────────────
		const toolbar = root.createDiv({ cls: 'okr-ov-toolbar' });

		toolbar.createEl('button', { text: '+ new objective', cls: 'mod-cta' })
			.addEventListener('click', () => {
				new ObjectiveModal(this.app, this.plugin, undefined, () => { void this.render(); }).open();
			});

		toolbar.createDiv({ cls: 'okr-ov-toolbar-spacer' });

		// Group-by toggle
		toolbar.createSpan({ text: 'Group by:', cls: 'okr-ov-group-label' });
		const toggle = toolbar.createDiv({ cls: 'okr-ov-toggle' });
		this.addToggleBtn(toggle, 'Cycle', 'cycle');
		this.addToggleBtn(toggle, 'Owner', 'owner');

		// ── Cycle-type filter pills (only shown when grouping by cycle) ──
		const filterBar = root.createDiv({ cls: 'okr-ov-filter-bar' });
		if (this.groupBy === 'cycle') {
			this.renderFilterBar(filterBar, allObjectives);
		}

		if (allObjectives.length === 0) {
			const empty = root.createDiv({ cls: 'okr-empty-state' });
			empty.createEl('p', { text: 'No OKRs yet. Create your first objective!' });
			return;
		}

		// ── Apply cycle-type filter ────────────────────────────────
		const objectives =
			this.groupBy === 'owner' || this.cycleTypeFilter === 'all'
				? allObjectives
				: allObjectives.filter(
					(o) => parseCycle(o.cycle).type === this.cycleTypeFilter
				  );

		// ── Board ──────────────────────────────────────────────────
		this.renderBoard(root.createDiv({ cls: 'okr-ov-board' }), objectives);
	}

	private addToggleBtn(parent: HTMLElement, label: string, value: GroupBy) {
		const btn = parent.createEl('button', {
			text: label,
			cls: `okr-ov-toggle-btn${this.groupBy === value ? ' is-active' : ''}`,
		});
		btn.addEventListener('click', () => {
			if (this.groupBy === value) return;
			this.groupBy = value;
			this.cycleTypeFilter = 'all'; // reset filter when switching group
			void this.render();
		});
	}

	private renderFilterBar(parent: HTMLElement, objectives: Objective[]) {
		// Collect which cycle types actually exist
		const presentTypes = new Set(objectives.map((o) => parseCycle(o.cycle).type));

		parent.createSpan({ text: 'Show:', cls: 'okr-ov-group-label' });

		const pills: Array<[CycleType | 'all', string]> = [
			['all', 'All'],
			...((['year', 'half', 'quarter', 'month', 'custom'] as CycleType[])
				.filter((t) => presentTypes.has(t))
				.map((t): [CycleType, string] => [t, CYCLE_TYPE_LABELS[t]])),
		];

		for (const [value, label] of pills) {
			const pill = parent.createEl('button', {
				text: label,
				cls: `okr-ov-filter-pill${this.cycleTypeFilter === value ? ' is-active' : ''}`,
			});
			pill.addEventListener('click', () => {
				if (this.cycleTypeFilter === value) return;
				this.cycleTypeFilter = value;
				void this.render();
			});
		}
	}

	private renderBoard(board: HTMLElement, objectives: Objective[]) {
		const grouped = new Map<string, Objective[]>();

		for (const obj of objectives) {
			const key =
				this.groupBy === 'owner'
					? obj.owner?.trim() || 'No Owner'
					: obj.cycle?.trim() || 'No Cycle';
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(obj);
		}

		// Sort: cycles by sortKey desc, owners alphabetically
		const keys = Array.from(grouped.keys()).sort((a, b) =>
			this.groupBy === 'cycle'
				? parseCycle(b).sortKey - parseCycle(a).sortKey
				: a.localeCompare(b)
		);

		for (const key of keys) {
			const col = board.createDiv({ cls: 'okr-ov-column' });
			const colObjs = grouped.get(key)!;
			const colAvg = Math.round(colObjs.reduce((s, o) => s + o.progress, 0) / colObjs.length);

			// Column header
			const headerRow = col.createDiv({ cls: 'okr-ov-col-header-row' });
			const headerTitle = headerRow.createDiv({ cls: 'okr-ov-col-header' });

			// For cycle columns, show the friendly label (e.g. "Jan 2026" instead of "2026-01")
			if (this.groupBy === 'cycle') {
				const parsed = parseCycle(key);
				headerTitle.textContent = parsed.label || key;
				if (parsed.type !== 'custom') {
					headerTitle.createSpan({
						text: ` · ${parsed.type}`,
						cls: 'okr-ov-col-type-tag',
					});
				}
			} else {
				headerTitle.textContent = key;
			}

			headerRow.createDiv({
				text: `${colObjs.length} obj · ${colAvg}% avg`,
				cls: 'okr-ov-col-meta',
			});

			const cards = col.createDiv({ cls: 'okr-ov-cards' });
			for (const obj of colObjs) this.renderCard(cards, obj);
		}
	}

	private renderStats(parent: HTMLElement, objectives: Objective[]) {
		const total = objectives.length;
		const onTrack = objectives.filter((o) => o.progress >= 70).length;
		const atRisk = objectives.filter((o) => o.progress > 0 && o.progress < 70).length;
		const notStarted = objectives.filter((o) => o.progress === 0 && o.status === 'not-started').length;
		const complete = objectives.filter((o) => o.status === 'complete').length;
		const avgProgress = total
			? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / total)
			: 0;

		for (const [value, label] of [
			[String(total), 'objectives'],
			[`${avgProgress}%`, 'avg progress'],
			[String(onTrack), 'on track'],
			[String(atRisk), 'at risk'],
			[String(complete), 'complete'],
			[String(notStarted), 'not started'],
		] as [string, string][]) {
			const stat = parent.createDiv({ cls: 'okr-ov-stat' });
			stat.createDiv({ text: value, cls: 'okr-ov-stat-value' });
			stat.createDiv({ text: label, cls: 'okr-ov-stat-label' });
		}
	}

	private renderCard(parent: HTMLElement, obj: Objective) {
		const card = parent.createDiv({ cls: 'okr-ov-card' });

		const title = card.createDiv({ text: obj.title, cls: 'okr-ov-card-title' });
		title.title = obj.title;

		const badgeRow = card.createDiv({ cls: 'okr-ov-card-badge-row' });
		badgeRow.createSpan({
			text: obj.status.replace(/-/g, ' '),
			cls: `okr-status-badge okr-status-${obj.status}`,
		});

		// Show the "other" dimension as context
		const contextText = this.groupBy === 'owner' ? obj.cycle : obj.owner;
		if (contextText) {
			// For cycle context tag, show the friendly label
			const displayText =
				this.groupBy === 'owner' ? parseCycle(obj.cycle).label : contextText;
			badgeRow.createSpan({ text: displayText, cls: 'okr-ov-context-tag' });
		}

		// Progress bar
		const pct = Math.min(100, Math.max(0, obj.progress));
		const fill = card.createDiv({ cls: 'okr-ov-progress-track' })
			.createDiv({ cls: 'okr-ov-progress-fill' });
		fill.style.width = `${pct}%`;
		fill.addClass(pct >= 70 ? 'okr-progress-high' : pct >= 30 ? 'okr-progress-mid' : 'okr-progress-low');

		const meta = card.createDiv({ cls: 'okr-ov-card-meta' });
		meta.createSpan({ text: `${pct}%`, cls: 'okr-ov-card-pct' });
		const krCount = obj.key_results.length;
		meta.createSpan({ text: `${krCount} KR${krCount !== 1 ? 's' : ''}`, cls: 'okr-kr-meta' });

		// KR mini-list
		if (krCount > 0) {
			const krList = card.createDiv({ cls: 'okr-ov-kr-list' });
			for (const kr of obj.key_results) {
				const row = krList.createDiv({ cls: 'okr-ov-kr-row' });
				row.createDiv({ text: kr.title, cls: 'okr-ov-kr-title' });
				const krPct = Math.min(100, Math.max(0, kr.progress));
				const kFill = row.createDiv({ cls: 'okr-ov-mini-track' })
					.createDiv({ cls: 'okr-ov-mini-fill' });
				kFill.style.width = `${krPct}%`;
				kFill.addClass(krPct >= 70 ? 'okr-progress-high' : krPct >= 30 ? 'okr-progress-mid' : 'okr-progress-low');
				row.createSpan({ text: `${krPct}%`, cls: 'okr-ov-kr-pct' });
			}
		}

		// Actions
		const actions = card.createDiv({ cls: 'okr-ov-card-actions' });

		actions.createEl('button', { text: 'Open', cls: 'okr-btn' })
			.addEventListener('click', () => { void this.app.workspace.getLeaf('tab').openFile(obj.file); });

		actions.createEl('button', { text: 'Edit', cls: 'okr-btn' })
			.addEventListener('click', () => {
				new ObjectiveModal(this.app, this.plugin, obj, () => { void this.render(); }).open();
			});

		if (obj.key_results.length > 0) {
			actions.createEl('button', { text: 'Check-in', cls: 'okr-btn mod-cta' })
				.addEventListener('click', (e) => {
					e.stopPropagation();
					const kr = obj.key_results.find((k) => k.status !== 'complete')
						?? obj.key_results[obj.key_results.length - 1];
					new CheckInModal(this.app, this.plugin, obj.file, kr, () => { void this.render(); }).open();
				});
		}

		actions.createEl('button', { text: '+ KR', cls: 'okr-btn' })
			.addEventListener('click', () => {
				new KrModal(this.app, this.plugin, obj.file, undefined, () => { void this.render(); }).open();
			});
	}
}
