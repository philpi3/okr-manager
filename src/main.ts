import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { OkrDashboardView, OKR_DASHBOARD_VIEW_TYPE } from './views/dashboard-view';
import { OkrOverviewView, OKR_OVERVIEW_VIEW_TYPE } from './views/overview-view';
import { ObjectiveModal } from './modals/objective-modal';
import { OkrManager } from './okr-manager';
import { OkrPluginSettings, DEFAULT_SETTINGS } from './types';

export default class OkrPlugin extends Plugin {
	settings!: OkrPluginSettings;
	manager!: OkrManager;

	async onload() {
		await this.loadSettings();
		this.manager = new OkrManager(this.app, this.settings);

		// Register views
		this.registerView(
			OKR_DASHBOARD_VIEW_TYPE,
			(leaf) => new OkrDashboardView(leaf, this)
		);
		this.registerView(
			OKR_OVERVIEW_VIEW_TYPE,
			(leaf) => new OkrOverviewView(leaf, this)
		);

		// Ribbon icons
		this.addRibbonIcon('layout-grid', 'OKR Overview', () => {
			this.activateOverview();
		});
		this.addRibbonIcon('target', 'OKR Dashboard', () => {
			this.activateDashboard();
		});

		// Commands
		this.addCommand({
			id: 'open-overview',
			name: 'Open OKR Overview',
			callback: () => this.activateOverview(),
		});

		this.addCommand({
			id: 'open-dashboard',
			name: 'Open OKR Dashboard (sidebar)',
			callback: () => this.activateDashboard(),
		});

		this.addCommand({
			id: 'new-objective',
			name: 'New Objective',
			callback: () => {
				const view = this.getActiveDashboardView();
				new ObjectiveModal(this.app, this, undefined, () =>
					view?.render()
				).open();
			},
		});

		// Settings tab
		this.addSettingTab(new OkrSettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Rebuild manager with updated settings
		this.manager = new OkrManager(this.app, this.settings);
	}

	async activateDashboard() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(OKR_DASHBOARD_VIEW_TYPE)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: OKR_DASHBOARD_VIEW_TYPE,
					active: true,
				});
				leaf = rightLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async activateOverview() {
		const { workspace } = this.app;
		// Always open in the main area as a tab
		let leaf = workspace.getLeavesOfType(OKR_OVERVIEW_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({ type: OKR_OVERVIEW_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	getActiveDashboardView(): OkrDashboardView | null {
		const leaves = this.app.workspace.getLeavesOfType(OKR_DASHBOARD_VIEW_TYPE);
		if (leaves.length > 0) {
			return leaves[0].view as OkrDashboardView;
		}
		return null;
	}
}

class OkrSettingsTab extends PluginSettingTab {
	plugin: OkrPlugin;

	constructor(app: App, plugin: OkrPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'OKR Manager Settings' });

		new Setting(containerEl)
			.setName('OKR folder')
			.setDesc('Folder where OKR notes will be created')
			.addText((text) =>
				text
					.setPlaceholder('OKRs')
					.setValue(this.plugin.settings.okrFolder)
					.onChange(async (value) => {
						this.plugin.settings.okrFolder = value || 'OKRs';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Default owner')
			.setDesc('Pre-filled owner name for new objectives')
			.addText((text) =>
				text
					.setPlaceholder('Your name')
					.setValue(this.plugin.settings.defaultOwner)
					.onChange(async (value) => {
						this.plugin.settings.defaultOwner = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
