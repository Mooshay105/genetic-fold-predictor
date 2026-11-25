import {
	CreateJobRequest,
	Job,
	JobStructure,
	ServerConnection,
	ServerInfo,
	UpdateJobRequest,
} from "./fold-server-api";

/** An error from a fold server, with the HTTP status (0 when unreachable). */
export class FoldServerError extends Error {
	/** HTTP status, or 0 when the server could not be reached. */
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

/**
 * Calls a fold server's API from the browser.
 * @param connection The server and token.
 * @param path The API path, starting with `/api/`.
 * @param init Request method and JSON body.
 * @returns The parsed JSON response, or undefined for an empty one.
 * @throws FoldServerError when the server is unreachable or answers with an error.
 */
export async function serverRequest<T>(
	connection: ServerConnection,
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${connection.url}${path}`, {
			method: init.method ?? "GET",
			headers: {
				Authorization: `Bearer ${connection.token}`,
				...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
		});
	} catch {
		throw new FoldServerError(0, "Could not reach your fold server. Check that it is running and the link is right.");
	}
	const text = await response.text();
	if (!response.ok) {
		let message = text.trim();
		try {
			message = JSON.parse(text).error ?? message;
		} catch {}
		if (response.status === 401) message = "Your fold server rejected the token. Paste the link it printed again.";
		throw new FoldServerError(response.status, message || `Your fold server returned HTTP ${response.status}.`);
	}
	return (text === "" ? undefined : JSON.parse(text)) as T;
}

/**
 * Fetches a fold server's version and queue size, which also checks the token.
 * @param connection The server and token.
 * @returns The server info.
 */
export function getServerInfo(connection: ServerConnection): Promise<ServerInfo> {
	return serverRequest<ServerInfo>(connection, "/api/info");
}

/**
 * Lists every job on a fold server, newest first.
 * @param connection The server and token.
 * @returns The jobs.
 */
export async function listJobs(connection: ServerConnection): Promise<Job[]> {
	return (await serverRequest<{ jobs: Job[] }>(connection, "/api/jobs")).jobs;
}

/**
 * Adds a job to a fold server's queue.
 * @param connection The server and token.
 * @param request The job name and chains.
 * @returns The new job.
 */
export function createJob(connection: ServerConnection, request: CreateJobRequest): Promise<Job> {
	return serverRequest<Job>(connection, "/api/jobs", { method: "POST", body: request });
}

/**
 * Edits a job that has not been predicted yet.
 * @param connection The server and token.
 * @param id The job ID.
 * @param request The fields to change.
 * @returns The updated job.
 */
export function updateJob(connection: ServerConnection, id: string, request: UpdateJobRequest): Promise<Job> {
	return serverRequest<Job>(connection, `/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", body: request });
}

/**
 * Deletes a job, stopping it if it is running.
 * @param connection The server and token.
 * @param id The job ID.
 */
export async function deleteJob(connection: ServerConnection, id: string): Promise<void> {
	await serverRequest<void>(connection, `/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Downloads the predicted structure of a finished job.
 * @param connection The server and token.
 * @param id The job ID.
 * @returns The mmCIF structure.
 */
export function getJobStructure(connection: ServerConnection, id: string): Promise<JobStructure> {
	return serverRequest<JobStructure>(connection, `/api/jobs/${encodeURIComponent(id)}/structure`);
}
