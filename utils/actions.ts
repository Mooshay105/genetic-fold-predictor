"use server";

import { PredictionInput } from "./types";

/** Structure prediction models the app can call. */
export type Model = "boltz2" | "openfold3";

/** A predicted structure file. */
export type Structure = {
	/** Full file contents. */
	text: string;
	/** File format, used for parsing and the download extension. */
	format: "pdb" | "cif";
};

/** Result of a prediction: the structure, or why it failed. */
export type PredictionResult =
	| { ok: true; structure: Structure }
	| { ok: false; status: number; message: string };

const ENDPOINTS: Record<Model, string> = {
	boltz2: "https://health.api.nvidia.com/v1/biology/mit/boltz2/predict",
	openfold3: "https://health.api.nvidia.com/v1/biology/openfold/openfold3/predict",
};

const STATUS_ENDPOINT = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/";

/** Seconds NVIDIA holds each request open before answering 202 and leaving us to poll. */
const POLL_SECONDS = 60;

/** Total time to wait for a prediction, kept under the page's `maxDuration` of 300 s. */
const DEADLINE_MS = 280_000;

/** Friendly explanations for HTTP statuses the NVIDIA API returns. */
const STATUS_MESSAGES: Record<number, string> = {
	401: "The server's NVIDIA API key is missing or was rejected.",
	402: "The NVIDIA account is out of credits.",
	403: "The NVIDIA API key is not allowed to use this model.",
	404: "The model was not found on NVIDIA's API.",
	422: "The model rejected the input.",
	429: "Too many requests to NVIDIA right now. Wait a moment and try again.",
	500: "NVIDIA's service had an internal error. Try again later, or switch model.",
	503: "The model is unavailable right now. Try again later, or switch model.",
	504: "The model timed out. Try fewer or shorter chains.",
};

function buildBody(model: Model, inputs: PredictionInput[]) {
	if (model === "openfold3") {
		return {
			request_id: "5GNJ",
			inputs: [{ input_id: "5GNJ", molecules: inputs, output_format: "pdb" }],
		};
	}
	return {
		polymers: inputs.map((input) => ({
			id: input.id,
			molecule_type: input.type,
			sequence: input.sequence,
			...(input.msa ? { msa: input.msa } : {}),
		})),
		recycling_steps: 3,
		sampling_steps: 50,
		diffusion_samples: 1,
		output_format: "mmcif",
	};
}

function readStructure(model: Model, json: unknown): Structure {
	const data = json as {
		outputs?: { structures_with_scores?: { structure?: unknown }[] }[];
		structures?: { structure?: unknown }[];
	};
	const text =
		model === "openfold3"
			? data.outputs?.[0]?.structures_with_scores?.[0]?.structure
			: data.structures?.[0]?.structure;
	if (typeof text !== "string" || text === "") throw new Error("empty structure");
	return { text, format: model === "openfold3" ? "pdb" : "cif" };
}

function describeBody(body: string): string {
	return summarise(rawDetail(body));
}

function summarise(detail: string): string {
	const [head] = detail.split(/\s*Traceback \(most recent call last\)/);
	const clean = head.replace(/\s+/g, " ").trim();
	return clean.length > 200 ? `${clean.slice(0, 197)}...` : clean;
}

function rawDetail(body: string): string {
	try {
		const json = JSON.parse(body);
		const detail = json.detail ?? json.message ?? json.error ?? json.title;
		if (typeof detail === "string") return detail;
		if (Array.isArray(detail)) {
			return detail
				.map((item) => (typeof item === "string" ? item : (item?.msg ?? JSON.stringify(item))))
				.join("; ");
		}
		if (detail !== undefined) return JSON.stringify(detail);
	} catch {}
	return body.trim();
}

/**
 * Sends chains to a structure prediction model on NVIDIA's hosted API and
 * returns the top-ranked structure, polling while the job is queued.
 * @param model Which model to use.
 * @param predictionInputs The chains to fold together.
 * @returns The structure file, or the HTTP status and reason it failed.
 */
export async function predictStructure(
	model: Model,
	predictionInputs: PredictionInput[],
): Promise<PredictionResult> {
	if (model !== "boltz2" && model !== "openfold3") {
		return { ok: false, status: 400, message: "Unknown model." };
	}
	const key = process.env.NVIDIA_API_KEY;
	if (!key) {
		console.error("Prediction: NVIDIA_API_KEY is not set");
		return { ok: false, status: 401, message: STATUS_MESSAGES[401] };
	}

	const headers = {
		"Authorization": `Bearer ${key}`,
		"Accept": "application/json",
		"Content-Type": "application/json",
		"NVCF-POLL-SECONDS": String(POLL_SECONDS),
	};
	const started = Date.now();

	let response: Response;
	try {
		response = await fetch(ENDPOINTS[model], {
			method: "POST",
			headers,
			body: JSON.stringify(buildBody(model, predictionInputs)),
		});
		while (response.status === 202) {
			const requestId = response.headers.get("nvcf-reqid");
			if (!requestId) break;
			if (Date.now() - started > DEADLINE_MS) {
				console.error(`Prediction (${model}): gave up waiting for ${requestId}`);
				return { ok: false, status: 504, message: STATUS_MESSAGES[504] };
			}
			response = await fetch(`${STATUS_ENDPOINT}${requestId}`, { headers });
		}
	} catch (error) {
		console.error(`Prediction (${model}): request failed`, error);
		return { ok: false, status: 0, message: "Could not reach the NVIDIA API." };
	}

	const body = await response.text();

	if (response.status !== 200) {
		const detail = describeBody(body);
		console.error(`Prediction (${model}): HTTP ${response.status} ${response.statusText}: ${rawDetail(body).slice(0, 2000)}`);
		const summary = STATUS_MESSAGES[response.status] ?? `The model returned HTTP ${response.status}.`;
		return {
			ok: false,
			status: response.status,
			message: detail && !summary.includes(detail) ? `${summary} (${detail})` : summary,
		};
	}

	try {
		return { ok: true, structure: readStructure(model, JSON.parse(body)) };
	} catch (error) {
		console.error(`Prediction (${model}): unexpected response`, error, body.slice(0, 500));
		return { ok: false, status: 200, message: "The model returned a response without a structure." };
	}
}
