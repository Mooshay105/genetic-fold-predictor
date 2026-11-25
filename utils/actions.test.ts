import { afterEach, beforeEach, expect, test } from "bun:test";
import { predictStructure } from "./actions";
import { PredictionInput } from "./types";

const realFetch = globalThis.fetch;
const realKey = process.env.NVIDIA_API_KEY;
const realError = console.error;

beforeEach(() => {
	process.env.NVIDIA_API_KEY = "test-key";
	console.error = () => {};
});

afterEach(() => {
	globalThis.fetch = realFetch;
	console.error = realError;
	if (realKey === undefined) delete process.env.NVIDIA_API_KEY;
	else process.env.NVIDIA_API_KEY = realKey;
});

const protein: PredictionInput = {
	type: "protein",
	sequence: "MGREEPLNHV",
	id: "A",
	msa: { main_db: { csv: { alignment: "key,sequence\n-1,MGREEPLNHV", format: "csv" } } },
	output_format: "pdb",
};

const dna: PredictionInput = {
	type: "dna",
	sequence: "ACGT",
	id: "B",
	output_format: "pdb",
};

type Call = { url: string; init?: RequestInit };

function stubFetch(responses: Response[]) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		const next = responses.shift();
		if (!next) throw new Error("unexpected fetch");
		return next;
	}) as unknown as typeof fetch;
	return calls;
}

test("sends polymers to Boltz-2 and returns the mmCIF structure", async () => {
	const calls = stubFetch([
		new Response(JSON.stringify({ structures: [{ structure: "data_model", format: "mmcif" }], confidence_scores: [0.9] })),
	]);

	const result = await predictStructure("boltz2", [protein, dna]);

	expect(result).toEqual({ ok: true, structure: { text: "data_model", format: "cif" } });
	expect(calls[0].url).toContain("mit/boltz2/predict");
	const body = JSON.parse(calls[0].init?.body as string);
	expect(body.output_format).toBe("mmcif");
	expect(body.polymers).toEqual([
		{ id: "A", molecule_type: "protein", sequence: "MGREEPLNHV", msa: protein.msa },
		{ id: "B", molecule_type: "dna", sequence: "ACGT" },
	]);
});

test("sends molecules to OpenFold3 and returns the PDB structure", async () => {
	const calls = stubFetch([
		new Response(JSON.stringify({ outputs: [{ structures_with_scores: [{ structure: "ATOM 1 N MET A 1" }] }] })),
	]);

	const result = await predictStructure("openfold3", [protein]);

	expect(result).toEqual({ ok: true, structure: { text: "ATOM 1 N MET A 1", format: "pdb" } });
	expect(calls[0].url).toContain("openfold3/predict");
	const body = JSON.parse(calls[0].init?.body as string);
	expect(body.inputs[0].molecules).toEqual([protein]);
	expect(body.inputs[0].output_format).toBe("pdb");
});

test("polls the NVCF status endpoint while the job is queued", async () => {
	const calls = stubFetch([
		new Response(null, { status: 202, headers: { "nvcf-reqid": "job-1" } }),
		new Response(null, { status: 202, headers: { "nvcf-reqid": "job-1" } }),
		new Response(JSON.stringify({ structures: [{ structure: "data_model" }] })),
	]);

	const result = await predictStructure("boltz2", [protein]);

	expect(result.ok).toBe(true);
	expect(calls.map((call) => call.url.endsWith("/status/job-1"))).toEqual([false, true, true]);
});

test("returns the status and API detail when the service fails", async () => {
	stubFetch([new Response(JSON.stringify({ detail: [{ msg: "Invalid sequence" }] }), { status: 422 })]);

	const result = await predictStructure("boltz2", [protein]);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.status).toBe(422);
		expect(result.message).toContain("Invalid sequence");
	}
});

test("drops the Python traceback from the message shown to the user", async () => {
	stubFetch([
		new Response(
			JSON.stringify({
				detail: "Error processing request: RuntimeError: Prediction failed\nTraceback (most recent call last):\n  File \"/usr/x.py\", line 1",
			}),
			{ status: 422 },
		),
	]);

	const result = await predictStructure("boltz2", [protein]);

	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.message).toContain("RuntimeError: Prediction failed");
		expect(result.message).not.toContain("Traceback");
	}
});

test("fails without calling the API when no key is set", async () => {
	delete process.env.NVIDIA_API_KEY;
	const calls = stubFetch([]);

	const result = await predictStructure("boltz2", [protein]);

	expect(calls).toHaveLength(0);
	expect(result).toMatchObject({ ok: false, status: 401 });
});

test("rejects an unknown model", async () => {
	const calls = stubFetch([]);

	const result = await predictStructure("alphafold" as "boltz2", [protein]);

	expect(calls).toHaveLength(0);
	expect(result).toMatchObject({ ok: false, status: 400 });
});

test("reports a response without a structure", async () => {
	stubFetch([new Response(JSON.stringify({ structures: [] }))]);

	const result = await predictStructure("boltz2", [protein]);

	expect(result).toMatchObject({ ok: false });
});
