import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type OkrPlugin from '../main';
import { Objective, KeyResult } from '../types';
import { ObjectiveModal } from '../modals/objective-modal';
import { KrModal } from '../modals/kr-modal';
import { CheckInModal } from '../modals/checkin-modal';
import { parseCycle } from '../cycle-parser';

export const OKR_DASHBOARD_VIEW_TYPE = 'okr-dashboard';

export class OkrDashboardView extends ItemView {
	private plugin: OkrPlugin;
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: OkrPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return OKR_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'OKR Dashboard';
	}

	getIcon(): string {
		return 'target';
	}

	async onOpen() {
		// Register vault events for auto-refresh
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) return;
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.type === 'okr-objective') {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('create', () => this.scheduleRefresh())
		);

		this.registerEvent(
			this.app.vault.on('delete', () => this.scheduleRefresh())
		);

		await this.render();
	}

	onClose(): Promise<void> {
		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
		}
		return Promise.resolve();
	}

	private scheduleRefresh() {
		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			void this.render();
			this.refreshTimeout = null;
		}, 300);
	}

	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('okr-dashboard');

		// Header
		const header = container.createDiv({ cls: 'okr-dashboard-header' });
		header.createEl('h2', { text: 'OKR Dashboard' });
		const headerActions = header.createDiv({ cls: 'okr-header-actions' });
		const newObjBtn = headerActions.createEl('button', {
			text: '+ New objective',
			cls: 'mod-cta',
		});
		newObjBtn.addEventListener('click', () => {
			new ObjectiveModal(this.app, this.plugin, undefined, () => {
				void this.render();
			}).open();
		});

		// Load objectives
		const objectives = await this.plugin.manager.getAllObjectives();

		if (objectives.length === 0) {
			const empty = container.createDiv({ cls: 'okr-empty-state' });
			empty.createEl('p', {
				text: 'No OKRs yet. Create your first objective to get started!',
			});
			const emptyBtn = empty.createEl('button', {
				text: '+ New objective',
				cls: 'mod-cta',
			});
			emptyBtn.addEventListener('click', () => {
				new ObjectiveModal(this.app, this.plugin, undefined, () =>
					this.render()
				).open();
			});
			return;
		}

		// Group by cycle
		const byCycle = new Map<string, Objective[]>();
		for (const obj of objectives) {
			const cycle = obj.cycle || 'No Cycle';
			if (!byCycle.has(cycle)) byCycle.set(cycle, []);
			byCycle.get(cycle)!.push(obj);
		}

		// Render each cycle group (already sorted most-recent-first from manager)
		const sortedCycles = Array.from(byCycle.keys()).sort(
			(a, b) => parseCycle(b).sortKey - parseCycle(a).sortKey
		);

		for (const cycle of sortedCycles) {
			const cycleGroup = container.createDiv({ cls: 'okr-cycle-group' });
			cycleGroup.createEl('h3', { text: cycle, cls: 'okr-cycle-header' });

			for (const obj of byCycle.get(cycle)!) {
				this.renderObjectiveCard(cycleGroup, obj);
			}
		}
	}

	private renderObjectiveCard(parent: HTMLElement, obj: Objective) {
		const card = parent.createDiv({ cls: 'okr-objective-card' });

		// Card header: title + badge + actions
		const cardHeader = card.createDiv({ cls: 'okr-objective-header' });
		const titleArea = cardHeader.createDiv({ cls: 'okr-objective-title-area' });
		titleArea.createDiv({ text: obj.title, cls: 'okr-objective-title' });
		titleArea.createSpan({
			text: obj.status.replace(/-/g, ' '),
			cls: `okr-status-badge okr-status-${obj.status}`,
		});

		const actions = cardHeader.createDiv({ cls: 'okr-objective-actions' });
		const editBtn = actions.createEl('button', { text: 'Edit', cls: 'okr-btn' });
		editBtn.addEventListener('click', () => {
			new ObjectiveModal(this.app, this.plugin, obj, () => {
				void this.render();
			}).open();
		});

		// Owner / meta
		if (obj.owner) {
			card.createDiv({
				text: `Owner: ${obj.owner}`,
				cls: 'okr-kr-meta',
			});
		}

		// Overall progress bar
		this.renderProgressBar(card, obj.progress, 'Overall progress');

		// KR list
		if (obj.key_results.length > 0) {
			const krList = card.createDiv({ cls: 'okr-kr-list' });
			for (const kr of obj.key_results) {
				this.renderKrRow(krList, obj, kr);
			}
		}

		// Add KR button
		const addKrBtn = card.createEl('button', {
			text: '+ Add key result',
			cls: 'okr-add-kr',
		});
		addKrBtn.addEventListener('click', () => {
			new KrModal(this.app, this.plugin, obj.file, undefined, () => {
				void this.render();
			}).open();
		});
	}

	private renderKrRow(parent: HTMLElement, obj: Objective, kr: KeyResult) {
		const row = parent.createDiv({ cls: 'okr-kr-row' });

		const krHeader = row.createDiv({ cls: 'okr-kr-header' });
		const titleArea = krHeader.createDiv({ cls: 'okr-kr-title-area' });
		titleArea.createDiv({ text: kr.title, cls: 'okr-kr-title' });
		titleArea.createDiv({
			text: `${kr.current_value} / ${kr.target} ${kr.unit}`,
			cls: 'okr-kr-meta',
		});

		const krActions = krHeader.createDiv({ cls: 'okr-kr-actions' });

		const checkinBtn = krActions.createEl('button', {
			text: 'Check-in',
			cls: 'okr-btn mod-cta',
		});
		checkinBtn.addEventListener('click', () => {
			new CheckInModal(this.app, this.plugin, obj.file, kr, () => {
				void this.render();
			}).open();
		});

		const editKrBtn = krActions.createEl('button', {
			text: 'Edit',
			cls: 'okr-btn',
		});
		editKrBtn.addEventListener('click', () => {
			new KrModal(this.app, this.plugin, obj.file, kr, () => {
				void this.render();
			}).open();
		});

		this.renderProgressBar(row, kr.progress, kr.status.replace(/-/g, ' '));
	}

	private renderProgressBar(parent: HTMLElement, progress: number, label: string) {
		const pct = Math.min(100, Math.max(0, progress));
		const wrap = parent.createDiv({ cls: 'okr-progress-container' });
		const lbl = wrap.createDiv({ cls: 'okr-progress-label' });
		lbl.createSpan({ text: label });
		lbl.createSpan({ text: `${pct}%` });

		const track = wrap.createDiv({ cls: 'okr-progress-bar-track' });
		const fill = track.createDiv({ cls: 'okr-progress-bar-fill' });
		fill.style.width = `${pct}%`;

		if (pct >= 70) fill.addClass('okr-progress-high');
		else if (pct >= 30) fill.addClass('okr-progress-mid');
		else fill.addClass('okr-progress-low');
	}
}
