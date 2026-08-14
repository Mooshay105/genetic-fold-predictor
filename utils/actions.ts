"use server";

export async function getProteinPDBData(
	singleLetterAminoAcidChain: string,
): Promise<string> {
	console.log("Calling API");
	const response = await fetch(
		"https://health.api.nvidia.com/v1/biology/nvidia/esmfold",
		{
			method: "POST",
			headers: {
				"Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				sequence: singleLetterAminoAcidChain.trim(),
			}),
		},
	);
	console.log("Called API");

	if (!response.ok) {
		console.log(response);
		throw new Error("Prediction failed");
	}

	return (await response.json()).pdbs[0];
}
