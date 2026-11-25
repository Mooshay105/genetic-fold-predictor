import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Job, JobChain } from "../../utils/fold-server-api";
import { boltzArgs, findModel, toBoltzYaml } from "./boltz";
import { loadConfig } from "./config";
import { createHandler } from "./http";
import { JobQueue } from "./queue";
import { JobStore } from "./store";

const TOKEN = "test-token-0123456789";
const ORIGIN = "https://genetic-fold-predictor.malcolmjh.com";
const protein: JobChain = { id: "A", type: "protein", sequence: "MGREEPLNHV" };
const dna: JobChain = { id: "B", type: "dna", sequence: "ACGT" };

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "fold-server-test-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

type Pending = { id: string; resolve: (text: string) => void; reject: (error: Error) => void; signal: AbortSignal };

function setup() {
	const pending: Pending[] = [];
	const store = new JobStore(dir);
	const queue = new JobQueue(store, (id, _chains, signal) =>
		new Promise((resolve, reject) => {
			pending.push({ id, resolve, reject, signal });
			signal.addEventListener("abort", () => reject(new Error("aborted")));
		}),
	);
	const handle = createHandler({ store, queue, token: TOKEN, origins: [ORIGIN], version: "0.0.0" });
	const call = async (method: string, path: string, body?: unknown, token = TOKEN) => {
		const response = await handle(
			new Request(`http://localhost:8765${path}`, {
				method,
				headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);
		const text = await response.text();
		return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
	};
	return { store, queue, pending, call };
}

test("writes Boltz YAML with single-sequence MSAs for proteins", () => {
	expect(toBoltzYaml([protein, dna], false)).toBe(
		"version: 1\nsequences:\n  - protein:\n      id: A\n      sequence: MGREEPLNHV\n      msa: empty\n  - dna:\n      id: B\n      sequence: ACGT\n",
	);
	expect(toBoltzYaml([protein], true)).not.toContain("msa: empty");
});

test("passes the accelerator and MSA server flags to boltz", () => {
	const args = boltzArgs("in.yaml", "out", { command: "boltz", accelerator: "cpu", msaServer: true, workDir: dir });
	expect(args.slice(0, 2)).toEqual(["predict", "in.yaml"]);
	expect(args).toContain("--use_msa_server");
	expect(args[args.indexOf("--accelerator") + 1]).toBe("cpu");
});

test("finds the top-ranked model in Boltz's output folder", () => {
	const predictions = join(dir, "out", "boltz_results_x", "predictions", "x");
	mkdirSync(predictions, { recursive: true });
	writeFileSync(join(predictions, "x_model_0.cif"), "data_x");
	expect(findModel(join(dir, "out"))).toBe(join(predictions, "x_model_0.cif"));
});

test("keeps the token between starts and replaces it on rotate", () => {
	const first = loadConfig(dir).token;
	expect(loadConfig(dir).token).toBe(first);
	expect(loadConfig(dir, true).token).not.toBe(first);
});

test("rejects requests without the right token", async () => {
	const { call } = setup();
	expect((await call("GET", "/api/jobs", undefined, "wrong")).status).toBe(401);
	expect((await call("GET", "/api/info")).status).toBe(200);
});

test("answers CORS preflights for allowed origins only", async () => {
	const { store, queue } = setup();
	const handle = createHandler({ store, queue, token: TOKEN, origins: [ORIGIN], version: "0.0.0" });
	const allowed = await handle(new Request("http://localhost:8765/api/jobs", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
	expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
	const other = await handle(new Request("http://localhost:8765/api/jobs", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
	expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
});

test("queues jobs, runs them in order and serves the structure", async () => {
	const { call, pending, queue } = setup();
	const first = await call("POST", "/api/jobs", { name: "first", chains: [protein] });
	expect(first.status).toBe(201);
	const second = await call("POST", "/api/jobs", { name: "second", chains: [protein, dna] });
	expect(second.body.status).toBe("queued");
	expect(second.body.position).toBe(1);
	expect((await call("GET", `/api/jobs/${first.body.id}`)).body.status).toBe("running");
	expect((await call("GET", `/api/jobs/${first.body.id}/structure`)).status).toBe(409);

	pending[0].resolve("data_first");
	await queue.idle();
	expect((await call("GET", `/api/jobs/${first.body.id}`)).body.status).toBe("done");
	expect((await call("GET", `/api/jobs/${first.body.id}/structure`)).body).toEqual({ text: "data_first", format: "cif" });
	expect(pending[1].id).toBe(second.body.id);
	expect((await call("PATCH", `/api/jobs/${first.body.id}`, { name: "late" })).status).toBe(409);
});

test("rejects invalid jobs", async () => {
	const { call } = setup();
	expect((await call("POST", "/api/jobs", { name: "x", chains: [] })).status).toBe(400);
	expect((await call("POST", "/api/jobs", { name: "", chains: [protein] })).status).toBe(400);
	const bad = await call("POST", "/api/jobs", { name: "x", chains: [{ id: "A", type: "dna", sequence: "MGRE" }] });
	expect(bad.status).toBe(400);
	expect(bad.body.error).toContain("not valid dna");
});

test("editing a running job stops it and puts it back in the queue", async () => {
	const { call, pending } = setup();
	const job = (await call("POST", "/api/jobs", { name: "edit me", chains: [protein] })).body as Job;
	expect(pending).toHaveLength(1);

	const edited = await call("PATCH", `/api/jobs/${job.id}`, { name: "edited", chains: [protein, dna] });
	expect(edited.status).toBe(200);
	expect(pending[0].signal.aborted).toBe(true);
	expect(edited.body.name).toBe("edited");
	expect(edited.body.chains).toHaveLength(2);
	expect(edited.body.status).toBe("running");
	expect(pending).toHaveLength(2);
});

test("a failed job can be edited and retried, or deleted", async () => {
	const { call, pending, queue } = setup();
	const job = (await call("POST", "/api/jobs", { name: "flaky", chains: [protein] })).body as Job;
	pending[0].reject(new Error("out of memory"));
	await queue.idle();
	const failed = (await call("GET", `/api/jobs/${job.id}`)).body as Job;
	expect(failed.status).toBe("failed");
	expect(failed.error).toBe("out of memory");

	const retried = (await call("PATCH", `/api/jobs/${job.id}`, {})).body as Job;
	expect(retried.status).toBe("running");
	expect(retried.error).toBeUndefined();

	expect((await call("DELETE", `/api/jobs/${job.id}`)).status).toBe(204);
	expect(pending[1].signal.aborted).toBe(true);
	expect((await call("GET", `/api/jobs/${job.id}`)).status).toBe(404);
});

test("jobs survive a restart, and a running job goes back in the queue", async () => {
	const { call } = setup();
	const job = (await call("POST", "/api/jobs", { name: "persist", chains: [protein] })).body as Job;
	const reopened = new JobStore(dir).get(job.id);
	expect(reopened?.status).toBe("queued");
	expect(reopened?.chains).toEqual([protein]);
});
