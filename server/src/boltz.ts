import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JobChain } from "../../utils/fold-server-api";

/** How to run the `boltz` command. */
export type BoltzOptions = {
	/** Path or name of the `boltz` executable. */
	command: string;
	/** Hardware Boltz runs on. */
	accelerator: "gpu" | "cpu";
	/** Whether to build MSAs with the public ColabFold server, which sends sequences off this machine. */
	msaServer: boolean;
	/** Folder that holds each job's temporary input and output. */
	workDir: string;
};

/** Folds a job's chains and returns the mmCIF text; rejects when aborted or when Boltz fails. */
export type Runner = (id: string, chains: JobChain[], signal: AbortSignal) => Promise<string>;

/** Number of trailing Boltz output characters kept for error messages. */
const LOG_TAIL = 2000;

/**
 * Writes chains as a Boltz input YAML file. Without the MSA server, protein
 * chains use `msa: empty` (single-sequence mode), matching the site.
 * @param chains The chains to fold.
 * @param msaServer Whether Boltz will fetch MSAs itself.
 * @returns The YAML text.
 */
export function toBoltzYaml(chains: JobChain[], msaServer: boolean): string {
	const lines = ["version: 1", "sequences:"];
	for (const chain of chains) {
		lines.push(`  - ${chain.type}:`, `      id: ${chain.id}`, `      sequence: ${chain.sequence}`);
		if (chain.type === "protein" && !msaServer) lines.push("      msa: empty");
	}
	return `${lines.join("\n")}\n`;
}

/**
 * Finds the top-ranked structure Boltz wrote somewhere under a folder.
 * @param dir The `--out_dir` given to Boltz.
 * @returns The path to the `_model_0.cif` file, or undefined when there is none.
 */
export function findModel(dir: string): string | undefined {
	for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile() && entry.name.endsWith("_model_0.cif")) {
			return join(entry.parentPath, entry.name);
		}
	}
	return undefined;
}

/**
 * Builds the arguments for `boltz predict`.
 * @param input Path to the YAML input file.
 * @param outDir Folder Boltz writes into.
 * @param options How to run Boltz.
 * @returns The argument list.
 */
export function boltzArgs(input: string, outDir: string, options: BoltzOptions): string[] {
	return [
		"predict",
		input,
		"--out_dir",
		outDir,
		"--output_format",
		"mmcif",
		"--recycling_steps",
		"3",
		"--diffusion_samples",
		"1",
		"--accelerator",
		options.accelerator,
		"--override",
		...(options.msaServer ? ["--use_msa_server"] : []),
	];
}

/**
 * Makes a runner that folds each job with the local `boltz predict` command.
 * @param options How to run Boltz.
 * @returns The runner.
 */
export function boltzRunner(options: BoltzOptions): Runner {
	return (id, chains, signal) =>
		new Promise((resolve, reject) => {
			const dir = join(options.workDir, id);
			rmSync(dir, { recursive: true, force: true });
			mkdirSync(dir, { recursive: true });
			const input = join(dir, `${id}.yaml`);
			writeFileSync(input, toBoltzYaml(chains, options.msaServer));

			let log = "";
			const child = spawn(options.command, boltzArgs(input, join(dir, "out"), options), {
				stdio: ["ignore", "pipe", "pipe"],
				detached: true,
			});
			const kill = () => {
				try {
					if (child.pid) process.kill(-child.pid, "SIGTERM");
				} catch {}
			};
			if (signal.aborted) kill();
			signal.addEventListener("abort", kill, { once: true });
			const collect = (chunk: Buffer) => {
				log = (log + chunk.toString()).slice(-LOG_TAIL);
			};
			child.stdout.on("data", collect);
			child.stderr.on("data", collect);

			let settled = false;
			const finish = (error?: Error, text?: string) => {
				if (settled) return;
				settled = true;
				rmSync(dir, { recursive: true, force: true });
				if (error) reject(error);
				else resolve(text ?? "");
			};

			child.on("error", (error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") {
					finish(new Error(`Could not find "${options.command}". Install Boltz with "pip install boltz" or pass --boltz.`));
				} else {
					finish(error);
				}
			});
			child.on("close", (code) => {
				signal.removeEventListener("abort", kill);
				if (signal.aborted) return finish(new Error("aborted"));
				const model = code === 0 ? findModel(join(dir, "out")) : undefined;
				if (!model) {
					const tail = log.trim().split("\n").slice(-5).join("\n");
					return finish(new Error(`Boltz exited with code ${code}. ${tail}`.trim()));
				}
				finish(undefined, readFileSync(model, "utf8"));
			});
		});
}
