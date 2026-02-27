import { App, TFile, normalizePath } from 'obsidian';
import { Objective, KeyResult, OkrStatus, CheckIn, OkrPluginSettings } from './types';
import { parseCycle } from './cycle-parser';

export class OkrManager {
	constructor(private app: App, private settings: OkrPluginSettings) {}

	async getAllObjectives(): Promise<Objective[]> {
		const objectives: Objective[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.type === 'okr-objective') {
				const fm = cache.frontmatter;
				objectives.push({
					file,
					title: fm.title ?? file.basename,
					cycle: fm.cycle ?? '',
					owner: fm.owner ?? '',
					status: (fm.status as OkrStatus) ?? 'not-started',
					progress: fm.progress ?? 0,
					key_results: this.parseKeyResults(fm.key_results),
				});
			}
		}

		return objectives.sort(
			(a, b) => parseCycle(b.cycle).sortKey - parseCycle(a.cycle).sortKey
		);
	}

	private parseKeyResults(raw: unknown): KeyResult[] {
		if (!Array.isArray(raw)) return [];
		return raw.map((item: Record<string, unknown>) => ({
			id: String(item.id ?? `kr-${Date.now()}`),
			title: String(item.title ?? ''),
			target: Number(item.target ?? 0),
			unit: String(item.unit ?? ''),
			current_value: Number(item.current_value ?? 0),
			progress: Number(item.progress ?? 0),
			status: (item.status as OkrStatus) ?? 'not-started',
		}));
	}

	async getAvailableCycles(): Promise<string[]> {
		const objectives = await this.getAllObjectives();
		const cycles = new Set(objectives.map((o) => o.cycle).filter(Boolean));
		return Array.from(cycles).sort(
			(a, b) => parseCycle(b).sortKey - parseCycle(a).sortKey
		);
	}

	async createObjective(data: {
		title: string;
		cycle: string;
		owner: string;
		status: OkrStatus;
	}): Promise<TFile> {
		const folder = this.settings.okrFolder;

		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const safeTitle = data.title.replace(/[\\/:*?"<>|]/g, '-');
		let filename = normalizePath(`${folder}/${safeTitle}.md`);

		if (await this.app.vault.adapter.exists(filename)) {
			filename = normalizePath(`${folder}/${safeTitle}-${Date.now()}.md`);
		}

		const content = this.buildInitialContent(data);
		return this.app.vault.create(filename, content);
	}

	private buildInitialContent(data: {
		title: string;
		cycle: string;
		owner: string;
		status: OkrStatus;
	}): string {
		const titleYaml = data.title.includes('"')
			? `'${data.title}'`
			: `"${data.title}"`;
		return [
			'---',
			`type: okr-objective`,
			`title: ${titleYaml}`,
			`cycle: "${data.cycle}"`,
			`owner: "${data.owner}"`,
			`status: ${data.status}`,
			`progress: 0`,
			`key_results: []`,
			'---',
			'',
			'## Check-ins',
			'',
		].join('\n');
	}

	async updateObjective(
		file: TFile,
		updates: Partial<{
			title: string;
			cycle: string;
			owner: string;
			status: OkrStatus;
		}>
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			Object.assign(fm, updates);
		});
	}

	async addKeyResult(file: TFile, kr: Omit<KeyResult, 'id' | 'progress'>): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const krs: KeyResult[] = this.parseKeyResults(fm.key_results);
			const id = `kr-${Date.now()}`;
			const progress =
				kr.target > 0 ? Math.min(100, Math.round((kr.current_value / kr.target) * 100)) : 0;
			krs.push({ ...kr, id, progress });
			fm.key_results = krs;
			fm.progress = this.computeAvgProgress(krs);
		});
	}

	async updateKeyResult(
		file: TFile,
		krId: string,
		updates: Partial<KeyResult>
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const krs: KeyResult[] = this.parseKeyResults(fm.key_results);
			const idx = krs.findIndex((kr) => kr.id === krId);
			if (idx !== -1) {
				const updated = { ...krs[idx], ...updates };
				const target = updated.target || 1;
				updated.progress = Math.min(
					100,
					Math.round((updated.current_value / target) * 100)
				);
				krs[idx] = updated;
			}
			fm.key_results = krs;
			fm.progress = this.computeAvgProgress(krs);
		});
	}

	async addCheckIn(file: TFile, checkIn: CheckIn): Promise<void> {
		const content = await this.app.vault.read(file);
		const line = `- **${checkIn.date}** · ${checkIn.krTitle} → ${checkIn.value} · "${checkIn.note}"`;

		const header = '## Check-ins\n';
		if (content.includes(header)) {
			const insertPos = content.indexOf(header) + header.length;
			const newContent =
				content.slice(0, insertPos) + line + '\n' + content.slice(insertPos);
			await this.app.vault.modify(file, newContent);
		} else {
			await this.app.vault.modify(
				file,
				content.trimEnd() + '\n\n## Check-ins\n' + line + '\n'
			);
		}
	}

	private computeAvgProgress(krs: KeyResult[]): number {
		if (krs.length === 0) return 0;
		const total = krs.reduce((sum, kr) => sum + (kr.progress ?? 0), 0);
		return Math.round(total / krs.length);
	}
}
