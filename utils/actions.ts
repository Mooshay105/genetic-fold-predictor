"use server";

import { PredictionInput } from "./types";

export async function getProteinPDBData(
	predictionInputs: PredictionInput[],
): Promise<string> {
	console.log("Calling API");
	const response = await fetch(
		"https://health.api.nvidia.com/v1/biology/openfold/openfold3/predict",
		{
			method: "POST",
			headers: {
				"Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				request_id: "5GNJ",
				inputs: [
					{
						input_id: "5GNJ",
						molecules: predictionInputs,
						output_format: "pdb",
					},
				],
			}),
		},
	);
	console.log("Called API");

	if (!response.ok) {
		console.log(response);
		throw new Error("Prediction failed");
	}

	return (await response.json()).outputs[0].structures_with_scores[0].structure;
}
