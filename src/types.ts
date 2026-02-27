import { TFile } from 'obsidian';

export type OkrStatus = 'not-started' | 'in-progress' | 'complete' | 'cancelled';

export interface KeyResult {
	id: string;
	title: string;
	target: number;
	unit: string;
	current_value: number;
	progress: number;
	status: OkrStatus;
}

export interface CheckIn {
	date: string;
	krTitle: string;
	value: number;
	note: string;
}

export interface Objective {
	file: TFile;
	title: string;
	cycle: string;
	owner: string;
	status: OkrStatus;
	progress: number;
	key_results: KeyResult[];
}

export interface OkrPluginSettings {
	okrFolder: string;
	defaultOwner: string;
}

export const DEFAULT_SETTINGS: OkrPluginSettings = {
	okrFolder: 'OKRs',
	defaultOwner: '',
};
