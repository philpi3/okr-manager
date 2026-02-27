import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type OkrPlugin from '../main';
import { KeyResult } from '../types';

export class CheckInModal extends Modal {
	private plugin: OkrPlugin;
	private objectiveFile: TFile;
	private kr: KeyResult;
	private onSave: (() => void) | undefined;

	private newValue: number;
	private note = '';

	constructor(
		app: App,
		plugin: OkrPlugin,
		objectiveFile: TFile,
		kr: KeyResult,
		onSave?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.objectiveFile = objectiveFile;
		this.kr = kr;
		this.onSave = onSave;
		this.newValue = kr.current_value;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName('Log check-in').setHeading();

		// KR summary card
		const info = contentEl.createDiv({ cls: 'okr-checkin-kr-info' });
		info.createDiv({ text: this.kr.title, cls: 'okr-checkin-kr-title' });
		info.createDiv({
			text: `Current: ${this.kr.current_value} / ${this.kr.target} ${this.kr.unit} (${this.kr.progress}%)`,
			cls: 'okr-checkin-current',
		});

		// New value
		new Setting(contentEl)
			.setName('New value')
			.setDesc(`Enter the updated ${this.kr.unit || 'value'} (target: ${this.kr.target} ${this.kr.unit})`)
			.addText((text) => {
				text
					.setValue(String(this.newValue))
					.onChange((v) => (this.newValue = parseFloat(v) || 0));
				text.inputEl.type = 'number';
				text.inputEl.addClass('okr-input-num');
			});

		// Note
		new Setting(contentEl)
			.setName('Note')
			.setDesc('What happened? What did you learn?')
			.addTextArea((area) => {
				area
					.setPlaceholder('Optional note about this check-in...')
					.setValue(this.note)
					.onChange((v) => (this.note = v));
				area.inputEl.rows = 3;
				area.inputEl.addClass('okr-input-full');
			});

		// Actions
		const actionRow = contentEl.createDiv({ cls: 'okr-modal-actions' });

		const cancelBtn = actionRow.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = actionRow.createEl('button', {
			text: 'Log check-in',
			cls: 'mod-cta',
		});
		saveBtn.addEventListener('click', () => this.save());
	}

	private async save() {
		const today = new Date().toISOString().split('T')[0];

		try {
			await this.plugin.manager.updateKeyResult(
				this.objectiveFile,
				this.kr.id,
				{ current_value: this.newValue }
			);

			await this.plugin.manager.addCheckIn(this.objectiveFile, {
				date: today,
				krTitle: this.kr.title,
				value: this.newValue,
				note: this.note.trim() || '—',
			});

			const newProgress = this.kr.target > 0
				? Math.min(100, Math.round((this.newValue / this.kr.target) * 100))
				: 0;
			new Notice(`Check-in logged. Progress: ${newProgress}%`);

			this.onSave?.();
			this.close();
		} catch (e) {
			new Notice(`Error logging check-in: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
