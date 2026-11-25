import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Job, JobChain } from "../../utils/fold-server-api";

/** Fields a job store can change on a job. */
export type JobPatch = Partial<Omit<Job, "id" | "createdAt" | "position">>;

/**
 * Keeps jobs in `jobs.json` and finished structures in `results/<id>.cif`
 * inside the data directory. Writes go through a temporary file and a rename,
 * so a crash never leaves a half-written `jobs.json`.
 */
export class JobStore {
	private jobs = new Map<string, Job>();
	private readonly file: string;
	private readonly results: string;

	constructor(private readonly dir: string) {
		this.file = join(dir, "jobs.json");
		this.results = join(dir, "results");
		mkdirSync(this.results, { recursive: true });
		let saved: Job[] = [];
		try {
			saved = JSON.parse(readFileSync(this.file, "utf8"));
		} catch {}
		for (const job of saved) {
			this.jobs.set(job.id, job.status === "running" ? { ...job, status: "queued" } : job);
		}
	}

	list(): Job[] {
		const all = [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		return all.map((job) => this.withPosition(job));
	}

	get(id: string): Job | undefined {
		const job = this.jobs.get(id);
		return job && this.withPosition(job);
	}

	create(name: string, chains: JobChain[]): Job {
		const now = new Date().toISOString();
		const job: Job = {
			id: randomBytes(6).toString("hex"),
			name,
			status: "queued",
			chains,
			createdAt: now,
			updatedAt: now,
		};
		this.jobs.set(job.id, job);
		this.save();
		return this.withPosition(job);
	}

	update(id: string, patch: JobPatch): Job | undefined {
		const job = this.jobs.get(id);
		if (!job) return undefined;
		const next: Job = { ...job, ...patch, updatedAt: new Date().toISOString() };
		for (const key of Object.keys(next) as (keyof Job)[]) {
			if (next[key] === undefined) delete next[key];
		}
		this.jobs.set(id, next);
		this.save();
		return this.withPosition(next);
	}

	delete(id: string): boolean {
		if (!this.jobs.delete(id)) return false;
		rmSync(this.resultPath(id), { force: true });
		this.save();
		return true;
	}

	nextQueued(): Job | undefined {
		return this.queue()[0];
	}

	counts(): { queued: number; running: number } {
		const all = [...this.jobs.values()];
		return {
			queued: all.filter((job) => job.status === "queued").length,
			running: all.filter((job) => job.status === "running").length,
		};
	}

	writeResult(id: string, text: string) {
		writeFileSync(this.resultPath(id), text);
	}

	readResult(id: string): string | undefined {
		try {
			return readFileSync(this.resultPath(id), "utf8");
		} catch {
			return undefined;
		}
	}

	private resultPath(id: string) {
		return join(this.results, `${id}.cif`);
	}

	private queue(): Job[] {
		return [...this.jobs.values()]
			.filter((job) => job.status === "queued")
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	}

	private withPosition(job: Job): Job {
		if (job.status !== "queued") return job;
		const running = this.counts().running;
		return { ...job, position: this.queue().findIndex((queued) => queued.id === job.id) + running };
	}

	private save() {
		const temp = `${this.file}.tmp`;
		writeFileSync(temp, JSON.stringify([...this.jobs.values()], null, "\t"));
		renameSync(temp, this.file);
	}
}
