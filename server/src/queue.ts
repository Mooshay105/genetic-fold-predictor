import { Runner } from "./boltz";
import { JobStore } from "./store";

/**
 * Runs queued jobs one at a time, oldest first. Call `wake` after adding or
 * requeueing a job, and `stop` before editing or deleting the running one.
 */
export class JobQueue {
	private current: { id: string; controller: AbortController; done: Promise<void> } | null = null;
	private closed = false;

	constructor(
		private readonly store: JobStore,
		private readonly runner: Runner,
		private readonly log: (message: string) => void = () => {},
	) {}

	wake() {
		if (this.current || this.closed) return;
		const job = this.store.nextQueued();
		if (!job) return;
		const controller = new AbortController();
		this.store.update(job.id, { status: "running", startedAt: new Date().toISOString(), error: undefined, finishedAt: undefined });
		this.log(`job ${job.id} (${job.name}) started`);
		const done = this.runner(job.id, job.chains, controller.signal).then(
			(text) => {
				if (controller.signal.aborted) return;
				this.store.writeResult(job.id, text);
				this.store.update(job.id, { status: "done", finishedAt: new Date().toISOString() });
				this.log(`job ${job.id} done`);
			},
			(error: unknown) => {
				if (controller.signal.aborted) return;
				const message = error instanceof Error ? error.message : String(error);
				this.store.update(job.id, { status: "failed", finishedAt: new Date().toISOString(), error: message });
				this.log(`job ${job.id} failed: ${message}`);
			},
		);
		this.current = { id: job.id, controller, done };
		done.finally(() => {
			this.current = null;
			this.wake();
		});
	}

	runningId(): string | undefined {
		return this.current?.id;
	}

	async stop(id: string) {
		const current = this.current;
		if (!current || current.id !== id) return;
		current.controller.abort();
		this.log(`job ${id} stopped`);
		await current.done;
	}

	async close() {
		this.closed = true;
		const current = this.current;
		if (!current) return;
		current.controller.abort();
		await current.done;
		this.store.update(current.id, { status: "queued", startedAt: undefined });
	}

	idle(): Promise<void> {
		return this.current?.done ?? Promise.resolve();
	}
}
