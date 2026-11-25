/** Molecule types OpenFold3 accepts from this app. */
export type MoleculeType = "protein" | "dna";

/** One molecule in an OpenFold3 prediction request. */
export type PredictionInput = {
	/** Molecule type. */
	type: MoleculeType;
	/** One-letter sequence. */
	sequence: string;
	/** Chain ID, `A` onwards. */
	id: string;
	/** Single-sequence multiple sequence alignment sent with the chain. */
	msa?: {
		main_db: {
			csv: {
				alignment: string;
				format: "csv";
			};
		};
	};
	/** Structure format to return. */
	output_format: "pdb";
};
