import presetData from "../public/protein-presets.json";
import { Preset, presetSequences } from "./chains";

/** Every bundled preset. */
export const PRESETS: Preset[] = presetData;

/**
 * Filters presets by a search query matched against name and source.
 * @param query Text the user typed; empty returns every preset.
 * @returns The matching presets.
 */
export function searchPresets(query: string): Preset[] {
	const needle = query.trim().toLowerCase();
	if (needle === "") return PRESETS;
	return PRESETS.filter((preset) =>
		`${preset.name} ${preset.from} ${preset.type}`.toLowerCase().includes(needle),
	);
}

/**
 * Describes a preset's size, such as "2 chains, 30 nt" or "88 aa".
 * @param preset The preset.
 * @returns A short summary.
 */
export function presetSummary(preset: Preset): string {
	const sequences = presetSequences(preset);
	const length = sequences.reduce((sum, sequence) => sum + sequence.length, 0);
	const unit = preset.type === "dna" ? "nt" : "aa";
	return sequences.length > 1 ? `${sequences.length} chains, ${length} ${unit}` : `${length} ${unit}`;
}
