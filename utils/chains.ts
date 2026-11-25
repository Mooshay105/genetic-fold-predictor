import { MoleculeType, PredictionInput } from "./types";

/** A protein or DNA preset as stored in `public/protein-presets.json`. */
export type Preset = {
	/** Display name, also used as the default download file name. */
	name: string;
	/** Whether the preset holds several chains in `singleLetterAminoAcidChains`. */
	multipleSingleLetterAminoAcidChains: boolean;
	/** The single chain of a one-chain preset. */
	singleLetterAminoAcidChain?: string;
	/** The chains of a multi-chain preset. */
	singleLetterAminoAcidChains?: string[];
	/** Where the sequence came from. */
	link: string;
	/** The source organisation, such as NIH or UniProt. */
	from: string;
	/** Molecule type of every chain in the preset. */
	type: string;
};

/** Letters a sequence may contain for each molecule type. */
export const VALID_RESIDUES: Record<MoleculeType, RegExp> = {
	protein: /^[ACDEFGHIKLMNPQRSTVWYUOBZXJ]*$/,
	dna: /^[ACGTN]*$/,
};

/**
 * Returns the chain ID that follows `id`, wrapping `Z` to `A` and `z` to `a`.
 * @param id The previous chain ID.
 * @returns The next chain ID.
 */
export function nextChainId(id: string): string {
	if (id === "Z") return "A";
	if (id === "z") return "a";
	return String.fromCharCode(id.charCodeAt(0) + 1);
}

/**
 * Upper-cases a sequence and strips whitespace, so pasted FASTA-style text works.
 * @param sequence The raw text the user typed or pasted.
 * @returns The cleaned sequence.
 */
export function cleanSequence(sequence: string): string {
	return sequence.replace(/\s+/g, "").toUpperCase();
}

/**
 * Checks a cleaned sequence against the letters allowed for its molecule type.
 * @param type The molecule type.
 * @param sequence The cleaned sequence.
 * @returns The sorted, de-duplicated invalid letters, empty when the sequence is valid.
 */
export function invalidResidues(type: MoleculeType, sequence: string): string[] {
	const bad = new Set<string>();
	for (const letter of sequence) {
		if (!VALID_RESIDUES[type].test(letter)) bad.add(letter);
	}
	return [...bad].sort();
}

/** Shortest sequence OpenFold3 accepts. */
export const MIN_SEQUENCE_LENGTH = 2;

/**
 * Builds one OpenFold3 molecule input. Protein chains get a single-sequence MSA;
 * DNA chains get none, because OpenFold3 only takes MSAs for protein and RNA.
 * @param type The molecule type.
 * @param sequence The cleaned sequence.
 * @param id The chain ID.
 * @returns The prediction input.
 */
export function makeInput(type: MoleculeType, sequence: string, id: string): PredictionInput {
	if (type === "dna") {
		return { type, sequence, id, output_format: "pdb" };
	}
	return {
		type,
		sequence,
		id,
		msa: {
			main_db: {
				csv: {
					alignment: `key,sequence\n-1,${sequence}`,
					format: "csv",
				},
			},
		},
		output_format: "pdb",
	};
}

/**
 * Re-assigns chain IDs from `A` in list order, so removing a chain leaves no gaps.
 * @param inputs The current inputs.
 * @returns New inputs with sequential IDs.
 */
export function relabelChains(inputs: PredictionInput[]): PredictionInput[] {
	let id = "A";
	return inputs.map((input, index) => {
		if (index > 0) id = nextChainId(id);
		return { ...input, id };
	});
}

/**
 * Appends a sequence as a new chain.
 * @param inputs The current inputs.
 * @param type The molecule type.
 * @param sequence The cleaned sequence.
 * @returns The inputs with the new chain added.
 */
export function appendChain(
	inputs: PredictionInput[],
	type: MoleculeType,
	sequence: string,
): PredictionInput[] {
	const id = inputs.length === 0 ? "A" : nextChainId(inputs[inputs.length - 1].id);
	return [...inputs, makeInput(type, sequence, id)];
}

/**
 * Lists the chains a preset contributes.
 * @param preset The preset.
 * @returns Its sequences, in order.
 */
export function presetSequences(preset: Preset): string[] {
	if (preset.multipleSingleLetterAminoAcidChains) {
		return preset.singleLetterAminoAcidChains ?? [];
	}
	return preset.singleLetterAminoAcidChain ? [preset.singleLetterAminoAcidChain] : [];
}

/**
 * Appends every chain of a preset.
 * @param inputs The current inputs.
 * @param preset The preset to add.
 * @returns The inputs with the preset's chains added.
 */
export function appendPreset(inputs: PredictionInput[], preset: Preset): PredictionInput[] {
	const type: MoleculeType = preset.type === "dna" ? "dna" : "protein";
	return presetSequences(preset).reduce(
		(acc, sequence) => appendChain(acc, type, sequence),
		inputs,
	);
}

/**
 * Turns a user-typed name into a safe download file name.
 * @param name The name from the file name field.
 * @returns The name with unsafe characters replaced, or `protein` when empty.
 */
export function fileSafeName(name: string): string {
	const safe = name.trim().replace(/[\\/:*?"<>|]+/g, "_");
	return safe === "" ? "protein" : safe;
}
