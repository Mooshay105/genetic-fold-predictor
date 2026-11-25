import { timingSafeEqual } from "node:crypto";
import {
	Job,
	ServerInfo,
	readChains,
	readName,
} from "../../utils/fold-server-api";
import { JobQueue } from "./queue";
import { JobPatch, JobStore } from "./store";

/** Origins allowed to call the API from a browser unless `--origin` adds more. */
export const DEFAULT_ORIGINS = [
	"https://genetic-fold-predictor.malcolmjh.com",
	"http://localhost:3000",
];

/** Largest request body the API reads, in bytes. */
const MAX_BODY_BYTES = 1_000_000;

/** What the request handler needs. */
export type HandlerOptions = {
	/** Job storage. */
	store: JobStore;
	/** Job runner. */
	queue: JobQueue;
	/** Token clients must send as `Authorization: Bearer <token>`. */
	token: string;
	/** Browser origins allowed by CORS. */
	origins: string[];
	/** Server version reported by `/api/info`. */
	version: string;
};

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

function sameToken(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
	const text = await request.text();
	if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "request body is too large");
	try {
		const body = JSON.parse(text);
		if (body && typeof body === "object" && !Array.isArray(body)) return body;
	} catch {}
	throw new HttpError(400, "body must be a JSON object");
}

function json(status: number, body: unknown): Response {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: body === undefined ? {} : { "Content-Type": "application/json" },
	});
}

/**
 * Builds the fetch-style handler for the fold server's HTTP API.
 * @param options Storage, queue, token and allowed origins.
 * @returns A function from request to response.
 */
export function createHandler(options: HandlerOptions): (request: Request) => Promise<Response> {
	const { store, queue, token, origins, version } = options;

	function findJob(id: string): Job {
		const job = store.get(id);
		if (!job) throw new HttpError(404, "job not found");
		return job;
	}

	async function route(request: Request, path: string[]): Promise<Response> {
		const method = request.method;
		if (path.length === 1 && path[0] === "info" && method === "GET") {
			const info: ServerInfo = { name: "fold-server", version, engine: "boltz2", ...store.counts() };
			return json(200, info);
		}
		if (path[0] !== "jobs") throw new HttpError(404, "not found");

		if (path.length === 1 && method === "GET") return json(200, { jobs: store.list() });
		if (path.length === 1 && method === "POST") {
			const body = await readBody(request);
			const name = readName(body.name);
			if (name === null) throw new HttpError(400, "name must be 1 to 100 characters");
			const chains = readChains(body.chains);
			if (!chains.ok) throw new HttpError(400, chains.message);
			const job = store.create(name, chains.chains);
			queue.wake();
			return json(201, store.get(job.id));
		}

		const id = path[1];
		if (path.length === 2 && method === "GET") return json(200, findJob(id));
		if (path.length === 2 && method === "PATCH") {
			const job = findJob(id);
			if (job.status === "done") throw new HttpError(409, "this job has already been predicted");
			const body = await readBody(request);
			const patch: JobPatch = {};
			if (body.name !== undefined) {
				const name = readName(body.name);
				if (name === null) throw new HttpError(400, "name must be 1 to 100 characters");
				patch.name = name;
			}
			if (body.chains !== undefined) {
				const chains = readChains(body.chains);
				if (!chains.ok) throw new HttpError(400, chains.message);
				patch.chains = chains.chains;
			}
			const requeue = job.status !== "queued" && (patch.chains !== undefined || job.status === "failed");
			if (requeue) {
				await queue.stop(id);
				Object.assign(patch, { status: "queued", startedAt: undefined, finishedAt: undefined, error: undefined });
			}
			store.update(id, patch);
			queue.wake();
			return json(200, findJob(id));
		}
		if (path.length === 2 && method === "DELETE") {
			findJob(id);
			await queue.stop(id);
			store.delete(id);
			queue.wake();
			return json(204, undefined);
		}
		if (path.length === 3 && path[2] === "structure" && method === "GET") {
			const job = findJob(id);
			const text = job.status === "done" ? store.readResult(id) : undefined;
			if (text === undefined) throw new HttpError(409, "this job has not been predicted yet");
			return json(200, { text, format: "cif" });
		}
		throw new HttpError(path.length <= 3 ? 405 : 404, "not found");
	}

	return async (request) => {
		const origin = request.headers.get("Origin");
		const cors: Record<string, string> =
			origin && origins.includes(origin)
				? {
						"Access-Control-Allow-Origin": origin,
						"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
						"Access-Control-Allow-Headers": "Authorization, Content-Type",
						"Access-Control-Max-Age": "600",
						Vary: "Origin",
					}
				: { Vary: "Origin" };
		const withCors = (response: Response) => {
			for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
			return response;
		};

		if (request.method === "OPTIONS") {
			const response = new Response(null, { status: 204 });
			if (request.headers.get("Access-Control-Request-Private-Network") === "true") {
				response.headers.set("Access-Control-Allow-Private-Network", "true");
			}
			return withCors(response);
		}

		const url = new URL(request.url);
		const path = url.pathname.split("/").filter(Boolean);
		if (path.length === 0) {
			return withCors(
				new Response("fold-server is running. Paste the link it printed into Genetic Fold Predictor.\n", {
					headers: { "Content-Type": "text/plain" },
				}),
			);
		}
		if (path[0] !== "api") return withCors(json(404, { error: "not found" }));

		const auth = request.headers.get("Authorization") ?? "";
		const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
		if (!sameToken(given, token)) return withCors(json(401, { error: "missing or wrong token" }));

		try {
			return withCors(await route(request, path.slice(1)));
		} catch (error) {
			if (error instanceof HttpError) return withCors(json(error.status, { error: error.message }));
			console.error(error);
			return withCors(json(500, { error: "internal error" }));
		}
	};
}
