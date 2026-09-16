export type PredictionInput = {
	type: "protein" | "dna";
	sequence: string;
	id: string;
	msa?: {
		main_db: {
			csv: {
				alignment: string;
				format: "csv";
			};
		};
	};
	output_format: "pdb";
};
