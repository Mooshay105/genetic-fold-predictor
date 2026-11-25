#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { serverLink } from "../../utils/fold-server-api";
import { boltzRunner } from "./boltz";
import { canRun, dataDir, loadConfig } from "./config";
import { DEFAULT_ORIGINS, createHandler } from "./http";
import { JobQueue } from "./queue";
import { JobStore } from "./store";
import packageJson from "../package.json";

const HELP = `fold-server ${packageJson.version}
Runs Boltz-2 on this machine for Genetic Fold Predictor. Jobs too big for
NVIDIA's hosted API are queued here, and you can check and edit them on the site.

Usage:
  fold-server start [options]   Start the server and print the link to paste into the site
  fold-server link [options]    Print the link again
  fold-server jobs [options]    List jobs
  fold-server token --rotate    Make a new token (old links stop working)

Options:
  --port <n>          Port to listen on (default 8765)
  --host <addr>       Address to listen on (default 127.0.0.1; 0.0.0.0 for every interface)
  --public-url <url>  The https:// URL a tunnel gives this server, used in the printed link
  --origin <url>      Extra site origin allowed to call the server (repeatable)
  --data-dir <dir>    Where jobs and the token live (default ~/.local/share/fold-server)
  --boltz <cmd>       The boltz command (default "boltz")
  --cpu               Run Boltz on the CPU instead of a GPU (much slower)
  --msa-server        Build MSAs with the public ColabFold server (sends sequences off this machine)
  -h, --help          Show this help
  -v, --version       Show the version
`;

/** Shape of the parts of `Bun.serve` this file uses, since the project has no Bun types. */
type BunServe = (options: {
	port: number;
	hostname: string;
	idleTimeout: number;
	fetch: (request: Request) => Promise<Response>;
}) => { port: number; stop: () => void };

function fail(message: string): never {
	console.error(`fold-server: ${message}`);
	process.exit(1);
}

const { values, positionals } = (() => {
	try {
		return parseArgs({
			allowPositionals: true,
			options: {
				port: { type: "string", default: "8765" },
				host: { type: "string", default: "127.0.0.1" },
				"public-url": { type: "string" },
				origin: { type: "string", multiple: true, default: [] },
				"data-dir": { type: "string" },
				boltz: { type: "string", default: "boltz" },
				cpu: { type: "boolean", default: false },
				"msa-server": { type: "boolean", default: false },
				rotate: { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
				version: { type: "boolean", short: "v", default: false },
			},
		});
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
})();

const command = positionals[0] ?? "help";
const dir = dataDir(values["data-dir"]);
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail("--port must be a number from 1 to 65535");

function printLink(token: string) {
	const shownHost = values.host === "0.0.0.0" || values.host === "::" ? "localhost" : values.host;
	const base = values["public-url"] ?? `http://${shownHost.includes(":") ? `[${shownHost}]` : shownHost}:${port}`;
	console.log(`\nPaste this link into Genetic Fold Predictor (My server):\n\n  ${serverLink(base, token)}\n`);
	if (!values["public-url"]) {
		console.log("Using the site from another device? Put this server behind an https:// tunnel");
		console.log("(for example Tailscale Funnel or a Cloudflare tunnel) and pass --public-url.\n");
	}
}

if (values.version) {
	console.log(packageJson.version);
} else if (values.help || command === "help") {
	console.log(HELP);
} else if (command === "token") {
	if (!values.rotate) fail("use 'fold-server token --rotate' to make a new token, or 'fold-server link' to see the link");
	printLink(loadConfig(dir, true).token);
} else if (command === "link") {
	printLink(loadConfig(dir).token);
} else if (command === "jobs") {
	const jobs = new JobStore(dir).list();
	if (jobs.length === 0) console.log("No jobs.");
	for (const job of jobs) {
		const residues = job.chains.reduce((sum, chain) => sum + chain.sequence.length, 0);
		const where = job.position !== undefined ? ` (#${job.position + 1} in line)` : "";
		console.log(`${job.id}  ${job.status.padEnd(7)}${where}  ${job.name}  ${job.chains.length} chains, ${residues} residues`);
		if (job.error) console.log(`    ${job.error}`);
	}
} else if (command === "start") {
	const serve = (globalThis as unknown as { Bun?: { serve: BunServe } }).Bun?.serve;
	if (!serve) fail("run fold-server with Bun (https://bun.sh)");
	if (!canRun(values.boltz)) {
		console.warn(`Warning: "${values.boltz}" was not found. Install Boltz with "pip install boltz" or pass --boltz. Jobs will fail until it is installed.`);
	}
	const { token } = loadConfig(dir);
	const store = new JobStore(dir);
	const runner = boltzRunner({
		command: values.boltz,
		accelerator: values.cpu ? "cpu" : "gpu",
		msaServer: values["msa-server"],
		workDir: join(dir, "work"),
	});
	const queue = new JobQueue(store, runner, (message) => console.log(`[${new Date().toISOString()}] ${message}`));
	const origins = [...DEFAULT_ORIGINS, ...values.origin.map((origin) => origin.replace(/\/+$/, ""))];
	const handler = createHandler({ store, queue, token, origins, version: packageJson.version });

	const server = serve({ port, hostname: values.host, idleTimeout: 60, fetch: handler });
	console.log(`fold-server ${packageJson.version} listening on ${values.host}:${server.port}, data in ${dir}`);
	printLink(token);
	queue.wake();

	let stopping = false;
	const shutdown = async () => {
		if (stopping) process.exit(1);
		stopping = true;
		console.log("Stopping; a running job goes back in the queue.");
		server.stop();
		await queue.close();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
} else {
	fail(`unknown command "${command}". Run 'fold-server help'.`);
}
