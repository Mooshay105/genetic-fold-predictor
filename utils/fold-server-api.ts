import { MIN_SEQUENCE_LENGTH, VALID_RESIDUES } from "./chains";
import { MoleculeType } from "./types";

/** Longest chain NVIDIA's hosted Boltz-2 accepts, in residues. */
export const API_MAX_CHAIN_LENGTH = 4096;

/** Most chains NVIDIA's hosted Boltz-2 accepts in one request. */
export const API_MAX_CHAINS = 12;

/** Longest job name the fold server stores. */
export const MAX_JOB_NAME_LENGTH = 100;

/** Most chains the fold server accepts in one job. */
export const MAX_JOB_CHAINS = 52;

/** One chain in a fold server job. */
export type JobChain = {
	/** Chain ID, `A` onwards. */
	id: string;
	/** Molecule type. */
	type: MoleculeType;
	/** Cleaned one-letter sequence. */
	sequence: string;
};

/** Where a job is in its life. */
export type JobStatus = "queued" | "running" | "done" | "failed";

/** A prediction job held by a fold server. */
export type Job = {
	/** Random job ID. */
	id: string;
	/** Name the user gave the job, used for downloads. */
	name: string;
	/** Current status. */
	status: JobStatus;
	/** Chains to fold together. */
	chains: JobChain[];
	/** When the job was created, as an ISO timestamp. */
	createdAt: string;
	/** When the job was last edited or changed status, as an ISO timestamp. */
	updatedAt: string;
	/** When the current or last run started. */
	startedAt?: string;
	/** When the last run finished. */
	finishedAt?: string;
	/** Why the last run failed. */
	error?: string;
	/** Number of jobs ahead of a queued job, counting the running one. */
	position?: number;
};

/** Body of a request that creates a job. */
export type CreateJobRequest = {
	/** Job name. */
	name: string;
	/** Chains to fold. */
	chains: JobChain[];
};

/** Body of a request that edits a job. Editing a running or failed job puts it back in the queue. */
export type UpdateJobRequest = {
	/** New job name. */
	name?: string;
	/** New chains. */
	chains?: JobChain[];
};

/** What `GET /api/info` returns. */
export type ServerInfo = {
	/** Always `fold-server`. */
	name: "fold-server";
	/** Server version. */
	version: string;
	/** Prediction engine the server runs. */
	engine: "boltz2";
	/** Number of jobs waiting. */
	queued: number;
	/** Number of jobs running. */
	running: number;
};

/** What `GET /api/jobs/:id/structure` returns. */
export type JobStructure = {
	/** mmCIF file contents. */
	text: string;
	/** File format. */
	format: "cif";
};

/** A saved link to a fold server. */
export type ServerConnection = {
	/** Base URL, without a trailing slash or token. */
	url: string;
	/** Access token the server printed. */
	token: string;
};

/** Result of reading a pasted server link. */
export type ParsedLink =
	| { ok: true; connection: ServerConnection }
	| { ok: false; message: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Reads the link `fold-server start` prints, such as
 * `http://localhost:8765/?token=abc`, into a base URL and token.
 * @param text The pasted link.
 * @returns The connection, or why the link cannot be used.
 */
export function parseServerLink(text: string): ParsedLink {
	let url: URL;
	try {
		url = new URL(text.trim());
	} catch {
		return { ok: false, message: "That is not a valid link." };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return { ok: false, message: "The link must start with http:// or https://." };
	}
	if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
		return {
			ok: false,
			message: "Browsers block plain http:// servers other than localhost. Put the server behind an https:// tunnel.",
		};
	}
	const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
	const token = url.searchParams.get("token") ?? hash.get("token") ?? "";
	if (token === "") {
		return { ok: false, message: "The link has no token. Copy the whole link the server printed." };
	}
	const path = url.pathname.replace(/\/+$/, "");
	return { ok: true, connection: { url: `${url.origin}${path}`, token } };
}

/**
 * Builds the link a fold server prints for users to paste into the site.
 * @param base The server's base URL.
 * @param token The access token.
 * @returns The link.
 */
export function serverLink(base: string, token: string): string {
	return `${base.replace(/\/+$/, "")}/?token=${encodeURIComponent(token)}`;
}

/**
 * Checks whether NVIDIA's hosted API would refuse these chains for size.
 * @param chains The chains to fold.
 * @returns True when a chain is too long or there are too many chains.
 */
export function exceedsApiLimits(chains: { sequence: string }[]): boolean {
	return (
		chains.length > API_MAX_CHAINS ||
		chains.some((chain) => chain.sequence.length > API_MAX_CHAIN_LENGTH)
	);
}

/**
 * Validates untrusted chains from a request body.
 * @param value The parsed `chains` field.
 * @returns The chains, or a message saying what is wrong.
 */
export function readChains(value: unknown): { ok: true; chains: JobChain[] } | { ok: false; message: string } {
	if (!Array.isArray(value) || value.length === 0) {
		return { ok: false, message: "chains must be a non-empty array" };
	}
	if (value.length > MAX_JOB_CHAINS) {
		return { ok: false, message: `at most ${MAX_JOB_CHAINS} chains are allowed` };
	}
	const chains: JobChain[] = [];
	const ids = new Set<string>();
	for (const item of value) {
		const { id, type, sequence } = (item ?? {}) as Record<string, unknown>;
		if (typeof id !== "string" || !/^[A-Za-z]$/.test(id) || ids.has(id)) {
			return { ok: false, message: "each chain needs a unique one-letter id" };
		}
		if (type !== "protein" && type !== "dna") {
			return { ok: false, message: `chain ${id} must be protein or dna` };
		}
		if (typeof sequence !== "string" || sequence.length < MIN_SEQUENCE_LENGTH) {
			return { ok: false, message: `chain ${id} needs at least ${MIN_SEQUENCE_LENGTH} letters` };
		}
		if (!VALID_RESIDUES[type].test(sequence)) {
			return { ok: false, message: `chain ${id} has letters that are not valid ${type}` };
		}
		ids.add(id);
		chains.push({ id, type, sequence });
	}
	return { ok: true, chains };
}

/**
 * Validates an untrusted job name.
 * @param value The parsed `name` field.
 * @returns The trimmed name, or null when it is not a usable name.
 */
export function readName(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const name = value.trim();
	if (name === "" || name.length > MAX_JOB_NAME_LENGTH) return null;
	return name;
}

/** Where the fold server's setup guide lives. */
export const SERVER_GUIDE_URL = "https://github.com/Mooshay105/genetic-fold-predictor/tree/main/server#readme";

/**
 * Describes a job's status for display, such as "Queued, #2 in line".
 * @param job The job.
 * @returns A short status line.
 */
export function describeJob(job: Job): string {
	if (job.status === "queued") {
		const place = (job.position ?? 0) + 1;
		return place === 1 ? "Queued, next up" : `Queued, #${place} in line`;
	}
	if (job.status === "running") return "Predicting...";
	if (job.status === "done") return "Done";
	return "Failed";
}

/**
 * Counts the residues in a job.
 * @param job The job.
 * @returns The total sequence length of its chains.
 */
export function jobResidues(job: Job): number {
	return job.chains.reduce((sum, chain) => sum + chain.sequence.length, 0);
}
