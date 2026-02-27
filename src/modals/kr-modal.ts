import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type OkrPlugin from '../main';
import { KeyResult, OkrStatus } from '../types';

export class KrModal extends Modal {
	private plugin: OkrPlugin;
	private objectiveFile: TFile;
	private existing: KeyResult | undefined;
	private onSave: (() => void) | undefined;

	private title = '';
	private target = 100;
	private unit = '%';
	private currentValue = 0;
	private status: OkrStatus = 'not-started';

	constructor(
		app: App,
		plugin: OkrPlugin,
		objectiveFile: TFile,
		existing?: KeyResult,
		onSave?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.objectiveFile = objectiveFile;
		this.existing = existing;
		this.onSave = onSave;

		if (existing) {
			this.title = existing.title;
			this.target = existing.target;
			this.unit = existing.unit;
			this.currentValue = existing.current_value;
			this.status = existing.status;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName(this.existing ? 'Edit key result' : 'Add key result').setHeading();

		// Title
		new Setting(contentEl)
			.setName('Title')
			.setDesc('What does success look like?')
			.addText((text) => {
				text
					.setPlaceholder('e.g. Reach $50k MRR')
					.setValue(this.title)
					.onChange((v) => (this.title = v));
				text.inputEl.addClass('okr-input-full');
			});

		// Target + Unit on same row
		new Setting(contentEl)
			.setName('Target')
			.setDesc('The goal number and its unit')
			.addText((text) => {
				text
					.setPlaceholder('100')
					.setValue(String(this.target))
					.onChange((v) => (this.target = parseFloat(v) || 0));
				text.inputEl.addClass('okr-input-sm');
				text.inputEl.type = 'number';
			})
			.addText((text) => {
				text
					.setPlaceholder('% / $ / deals')
					.setValue(this.unit)
					.onChange((v) => (this.unit = v));
				text.inputEl.addClass('okr-input-sm');
			});

		// Current value
		new Setting(contentEl)
			.setName('Current value')
			.setDesc('Where are you right now?')
			.addText((text) => {
				text
					.setPlaceholder('0')
					.setValue(String(this.currentValue))
					.onChange((v) => (this.currentValue = parseFloat(v) || 0));
				text.inputEl.addClass('okr-input-sm');
				text.inputEl.type = 'number';
			});

		// Status
		new Setting(contentEl).setName('Status').addDropdown((dd) => {
			dd.addOption('not-started', 'Not Started');
			dd.addOption('in-progress', 'In Progress');
			dd.addOption('complete', 'Complete');
			dd.addOption('cancelled', 'Cancelled');
			dd.setValue(this.status);
			dd.onChange((v) => (this.status = v as OkrStatus));
		});

		// Actions
		const actionRow = contentEl.createDiv({ cls: 'okr-modal-actions' });

		const cancelBtn = actionRow.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = actionRow.createEl('button', {
			text: this.existing ? 'Save changes' : 'Add key result',
			cls: 'mod-cta',
		});
		saveBtn.addEventListener('click', () => this.save());
	}

	private async save() {
		const title = this.title.trim();

		if (!title) {
			new Notice('Please enter a title for the key result.');
			return;
		}

		try {
			if (this.existing) {
				await this.plugin.manager.updateKeyResult(
					this.objectiveFile,
					this.existing.id,
					{
						title,
						target: this.target,
						unit: this.unit.trim(),
						current_value: this.currentValue,
						status: this.status,
					}
				);
				new Notice('Key result updated.');
			} else {
				await this.plugin.manager.addKeyResult(this.objectiveFile, {
					title,
					target: this.target,
					unit: this.unit.trim(),
					current_value: this.currentValue,
					status: this.status,
				});
				new Notice('Key result added.');
			}

			this.onSave?.();
			this.close();
		} catch (e) {
			new Notice(`Error saving key result: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
