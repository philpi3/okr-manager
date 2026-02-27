import { App, Modal, Setting, Notice } from 'obsidian';
import type OkrPlugin from '../main';
import { Objective, OkrStatus } from '../types';
import {
	CycleType,
	CYCLE_TYPE_LABELS,
	MONTH_NAMES,
	parseCycle,
	buildCycleString,
	defaultPeriod,
} from '../cycle-parser';

export class ObjectiveModal extends Modal {
	private plugin: OkrPlugin;
	private existing: Objective | undefined;
	private onSave: (() => void) | undefined;

	// Basic fields
	private title = '';
	private owner = '';
	private status: OkrStatus = 'not-started';

	// Cycle fields
	private cycleType: CycleType = 'quarter';
	private cycleYear: number = new Date().getFullYear();
	private cyclePeriod: number = defaultPeriod('quarter');
	private cycleCustom = '';

	// DOM refs for dynamic cycle section
	private periodRowEl: HTMLElement | null = null;
	private customRowEl: HTMLElement | null = null;
	private yearRowEl: HTMLElement | null = null;
	private cyclePreviewEl: HTMLElement | null = null;
	private periodSelectEl: HTMLSelectElement | null = null;

	constructor(app: App, plugin: OkrPlugin, existing?: Objective, onSave?: () => void) {
		super(app);
		this.plugin = plugin;
		this.existing = existing;
		this.onSave = onSave;

		if (existing) {
			this.title = existing.title;
			this.owner = existing.owner;
			this.status = existing.status;

			const parsed = parseCycle(existing.cycle);
			this.cycleType = parsed.type;
			this.cycleYear = parsed.year || new Date().getFullYear();
			this.cyclePeriod = parsed.period || 1;
			this.cycleCustom = parsed.type === 'custom' ? existing.cycle : '';
		} else {
			this.owner = plugin.settings.defaultOwner;
		}
	}

	private get cycleString(): string {
		if (this.cycleType === 'custom') return this.cycleCustom;
		return buildCycleString(this.cycleType, this.cycleYear, this.cyclePeriod);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl).setName(this.existing ? 'Edit objective' : 'New objective').setHeading();

		// ── Title ──────────────────────────────────────────────────
		new Setting(contentEl)
			.setName('Title')
			.setDesc('What do you want to achieve?')
			.addText((text) => {
				text.setPlaceholder('e.g. Grow product revenue')
					.setValue(this.title)
					.onChange((v) => (this.title = v));
				text.inputEl.addClass('okr-input-full');
			});

		// ── Cycle section ──────────────────────────────────────────
		new Setting(contentEl).setName('Cycle').setHeading();

		// Type dropdown
		new Setting(contentEl)
			.setName('Type')
			.addDropdown((dd) => {
				for (const [value, label] of Object.entries(CYCLE_TYPE_LABELS)) {
					dd.addOption(value, label);
				}
				dd.setValue(this.cycleType);
				dd.onChange((v) => {
					this.cycleType = v as CycleType;
					this.cyclePeriod = defaultPeriod(this.cycleType);
					this.onCycleTypeChange();
				});
			});

		// Year row
		const yearSetting = new Setting(contentEl)
			.setName('Year')
			.addText((text) => {
				text.setValue(String(this.cycleYear)).onChange((v) => {
					this.cycleYear = parseInt(v) || new Date().getFullYear();
					this.updatePreview();
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '2000';
				text.inputEl.max = '2100';
				text.inputEl.addClass('okr-input-sm');
			});
		this.yearRowEl = yearSetting.settingEl;

		// Period row (half / quarter / month)
		const periodSetting = new Setting(contentEl)
			.setName('Period')
			.addDropdown((dd) => {
				this.periodSelectEl = dd.selectEl;
				this.populatePeriodOptions(this.cycleType);
				dd.setValue(String(this.cyclePeriod));
				dd.onChange((v) => {
					this.cyclePeriod = parseInt(v);
					this.updatePreview();
				});
			});
		this.periodRowEl = periodSetting.settingEl;

		// Custom text row
		const customSetting = new Setting(contentEl)
			.setName('Cycle string')
			.setDesc('e.g. 2026-Q1, 2026-FY, Sprint-12')
			.addText((text) => {
				text.setPlaceholder('2026-Q1')
					.setValue(this.cycleCustom)
					.onChange((v) => {
						this.cycleCustom = v;
						this.updatePreview();
					});
				text.inputEl.addClass('okr-input-md');
			});
		this.customRowEl = customSetting.settingEl;

		// Preview
		const previewWrap = contentEl.createDiv({ cls: 'okr-cycle-preview-wrap' });
		previewWrap.createSpan({ text: 'Result: ', cls: 'okr-cycle-preview-label' });
		this.cyclePreviewEl = previewWrap.createSpan({ cls: 'okr-cycle-preview-value' });

		// Apply initial visibility
		this.onCycleTypeChange();

		// ── Owner ──────────────────────────────────────────────────
		new Setting(contentEl)
			.setName('Owner')
			.addText((text) => {
				text.setPlaceholder('Your name')
					.setValue(this.owner)
					.onChange((v) => (this.owner = v));
				text.inputEl.addClass('okr-input-full');
			});

		// ── Status ─────────────────────────────────────────────────
		new Setting(contentEl).setName('Status').addDropdown((dd) => {
			dd.addOption('not-started', 'Not Started');
			dd.addOption('in-progress', 'In Progress');
			dd.addOption('complete', 'Complete');
			dd.addOption('cancelled', 'Cancelled');
			dd.setValue(this.status);
			dd.onChange((v) => (this.status = v as OkrStatus));
		});

		// ── Actions ────────────────────────────────────────────────
		const actionRow = contentEl.createDiv({ cls: 'okr-modal-actions' });
		actionRow.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());
		actionRow.createEl('button', {
			text: this.existing ? 'Save changes' : 'Create objective',
			cls: 'mod-cta',
		}).addEventListener('click', () => this.save());
	}

	private onCycleTypeChange() {
		const type = this.cycleType;
		const isCustom = type === 'custom';
		const isYear = type === 'year';

		if (this.yearRowEl) isCustom ? this.yearRowEl.hide() : this.yearRowEl.show();
		if (this.periodRowEl) (isCustom || isYear) ? this.periodRowEl.hide() : this.periodRowEl.show();
		if (this.customRowEl) isCustom ? this.customRowEl.show() : this.customRowEl.hide();

		if (!isCustom && !isYear && this.periodSelectEl) {
			this.populatePeriodOptions(type);
			this.periodSelectEl.value = String(this.cyclePeriod);
		}

		this.updatePreview();
	}

	private populatePeriodOptions(type: CycleType) {
		const sel = this.periodSelectEl;
		if (!sel) return;

		// Clear existing options
		while (sel.firstChild) sel.removeChild(sel.firstChild);

		const add = (value: string, text: string) => {
			const opt = document.createElement('option');
			opt.value = value;
			opt.textContent = text;
			sel.appendChild(opt);
		};

		switch (type) {
			case 'half':
				add('1', 'H1 (Jan–Jun)');
				add('2', 'H2 (Jul–Dec)');
				break;
			case 'quarter':
				add('1', 'Q1 (Jan–Mar)');
				add('2', 'Q2 (Apr–Jun)');
				add('3', 'Q3 (Jul–Sep)');
				add('4', 'Q4 (Oct–Dec)');
				break;
			case 'month':
				MONTH_NAMES.forEach((m, i) => add(String(i + 1), m));
				break;
		}
	}

	private updatePreview() {
		if (this.cyclePreviewEl) {
			const val = this.cycleString;
			this.cyclePreviewEl.textContent = val || '—';
		}
	}

	private async save() {
		const title = this.title.trim();
		const cycle = this.cycleString.trim();

		if (!title) { new Notice('Please enter a title.'); return; }
		if (!cycle) { new Notice('Please complete the cycle selection.'); return; }

		try {
			if (this.existing) {
				await this.plugin.manager.updateObjective(this.existing.file, {
					title, cycle, owner: this.owner.trim(), status: this.status,
				});
				new Notice('Objective updated.');
			} else {
				await this.plugin.manager.createObjective({
					title, cycle, owner: this.owner.trim(), status: this.status,
				});
				new Notice('Objective created.');
			}
			this.onSave?.();
			this.close();
		} catch (e) {
			new Notice(`Error saving objective: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
