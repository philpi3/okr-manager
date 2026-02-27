export type CycleType = 'year' | 'half' | 'quarter' | 'month' | 'custom';

export interface ParsedCycle {
	raw: string;
	type: CycleType;
	year: number;
	period: number; // 1 for year, 1-2 for half, 1-4 for quarter, 1-12 for month
	sortKey: number; // larger = more recent; used for descending sort
	label: string; // human-readable display string
}

export const MONTH_NAMES = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
	year: 'Year',
	half: 'Half year',
	quarter: 'Quarter',
	month: 'Month',
	custom: 'Custom',
};

/**
 * Parse a cycle string into a structured object.
 *
 * Supported formats:
 *   Year    → "2026"
 *   Half    → "2026-H1" / "2026-H2"
 *   Quarter → "2026-Q1" … "2026-Q4"
 *   Month   → "2026-01" … "2026-12"
 *   Custom  → anything else
 */
export function parseCycle(raw: string): ParsedCycle {
	const s = (raw ?? '').trim();

	// Year: "2026"
	if (/^\d{4}$/.test(s)) {
		const year = parseInt(s);
		return { raw: s, type: 'year', year, period: 1, sortKey: year * 100000, label: s };
	}

	// Half: "2026-H1" / "2026-H2"
	const halfM = s.match(/^(\d{4})-H([12])$/i);
	if (halfM) {
		const year = parseInt(halfM[1]);
		const period = parseInt(halfM[2]);
		return {
			raw: s, type: 'half', year, period,
			sortKey: year * 100000 + period * 10000,
			label: `${year}-H${period}`,
		};
	}

	// Quarter: "2026-Q1" … "2026-Q4"
	const qM = s.match(/^(\d{4})-Q([1-4])$/i);
	if (qM) {
		const year = parseInt(qM[1]);
		const period = parseInt(qM[2]);
		return {
			raw: s, type: 'quarter', year, period,
			sortKey: year * 100000 + period * 1000,
			label: `${year}-Q${period}`,
		};
	}

	// Month: "2026-01" … "2026-12"
	const mM = s.match(/^(\d{4})-(\d{2})$/);
	if (mM) {
		const year = parseInt(mM[1]);
		const period = parseInt(mM[2]);
		if (period >= 1 && period <= 12) {
			return {
				raw: s, type: 'month', year, period,
				sortKey: year * 100000 + period,
				label: `${MONTH_NAMES[period - 1]} ${year}`,
			};
		}
	}

	// Custom / unrecognised
	return { raw: s, type: 'custom', year: 0, period: 0, sortKey: 0, label: s || 'No Cycle' };
}

/** Build a canonical cycle string from components. */
export function buildCycleString(type: CycleType, year: number, period: number): string {
	switch (type) {
		case 'year':    return `${year}`;
		case 'half':    return `${year}-H${period}`;
		case 'quarter': return `${year}-Q${period}`;
		case 'month':   return `${year}-${String(period).padStart(2, '0')}`;
		default:        return '';
	}
}

/** Return a smart default period for the current date and a given type. */
export function defaultPeriod(type: CycleType): number {
	const now = new Date();
	switch (type) {
		case 'quarter': return Math.ceil((now.getMonth() + 1) / 3);
		case 'half':    return now.getMonth() < 6 ? 1 : 2;
		case 'month':   return now.getMonth() + 1;
		default:        return 1;
	}
}
