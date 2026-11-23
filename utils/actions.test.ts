import { afterEach, expect, test } from "bun:test";
import { getProteinPDBData } from "./actions";
import { PredictionInput } from "./types";

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

const input: PredictionInput = {
	type: "protein",
	sequence: "MGREEPLNHV",
	id: "A",
	output_format: "pdb",
};

test("sends the molecules to OpenFold3 and returns the first PDB structure", async () => {
	let sentUrl = "";
	let sentBody: { inputs: { molecules: PredictionInput[]; output_format: string }[] } | undefined;
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		sentUrl = url;
		sentBody = JSON.parse(init.body as string);
		return new Response(
			JSON.stringify({
				outputs: [{ structures_with_scores: [{ structure: "ATOM 1 N MET A 1" }] }],
			}),
			{ status: 200 },
		);
	}) as unknown as typeof fetch;

	const pdb = await getProteinPDBData([input]);

	expect(pdb).toBe("ATOM 1 N MET A 1");
	expect(sentUrl).toContain("openfold3/predict");
	expect(sentBody?.inputs[0].molecules).toEqual([input]);
	expect(sentBody?.inputs[0].output_format).toBe("pdb");
});

test("throws when the prediction service fails", async () => {
	globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
	const log = console.log;
	console.log = () => {};
	try {
		await expect(getProteinPDBData([input])).rejects.toThrow("Prediction failed");
	} finally {
		console.log = log;
	}
});
