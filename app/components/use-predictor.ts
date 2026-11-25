"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Model, Structure, predictStructure } from "@/utils/actions";
import {
	Preset,
	appendChain,
	appendPreset,
	cleanSequence,
	fileSafeName,
	invalidResidues,
	MIN_SEQUENCE_LENGTH,
	makeInput,
	relabelChains,
} from "@/utils/chains";
import {
	API_MAX_CHAIN_LENGTH,
	API_MAX_CHAINS,
	Job,
	JobChain,
	MAX_JOB_NAME_LENGTH,
	exceedsApiLimits,
} from "@/utils/fold-server-api";
import { createJob, deleteJob, getJobStructure, updateJob } from "@/utils/fold-server-client";
import { MoleculeType, PredictionInput } from "@/utils/types";
import { DEFAULT_VIEWER_STYLE, ViewerStyle } from "@/utils/viewer-style";
import { useFoldServer } from "./use-fold-server";

/** The sequence being typed into the "add chain" row. */
export type Draft = {
	/** Molecule type of the new chain. */
	type: MoleculeType;
	/** Raw text typed so far. */
	sequence: string;
};

/** Outcome of the last successful prediction. */
export type RunInfo = {
	/** How long the request took, in milliseconds. */
	durationMs: number;
	/** Number of chains sent. */
	chains: number;
	/** Model that made the prediction. */
	model: Model;
};

/** Display names of the prediction models. */
export const MODEL_LABELS: Record<Model, string> = {
	boltz2: "Boltz-2",
	openfold3: "OpenFold3",
};

function toJobChains(inputs: PredictionInput[]): JobChain[] {
	return relabelChains(inputs).map(({ id, type, sequence }) => ({ id, type, sequence }));
}

function jobName(name: string): string {
	return name.trim().slice(0, MAX_JOB_NAME_LENGTH) || "protein";
}

function checkChains(inputs: PredictionInput[]): string | null {
	if (inputs.length === 0) return "Add at least one protein or DNA sequence first.";
	const bad = inputs.find((input) => invalidResidues(input.type, input.sequence).length > 0);
	if (bad) return `Chain ${bad.id} has letters that are not valid ${bad.type === "dna" ? "DNA" : "protein"}.`;
	const short = inputs.find((input) => input.sequence.length < MIN_SEQUENCE_LENGTH);
	if (short) return `Chain ${short.id} is too short. It needs at least ${MIN_SEQUENCE_LENGTH} letters.`;
	return null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Something went wrong talking to your fold server.";
}

function download(href: string, fileName: string) {
	const link = document.createElement("a");
	link.href = href;
	link.download = fileName;
	link.click();
}

export function usePredictor() {
	const [inputs, setInputs] = useState<PredictionInput[]>([]);
	const [draft, setDraft] = useState<Draft>({ type: "protein", sequence: "" });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [structure, setStructure] = useState<Structure | null>(null);
	const [model, setModel] = useState<Model>("boltz2");
	const [name, setName] = useState("protein");
	const [presetsOpen, setPresetsOpen] = useState(false);
	const [viewerStyle, setViewerStyle] = useState<ViewerStyle>(DEFAULT_VIEWER_STYLE);
	const [lastRun, setLastRun] = useState<RunInfo | null>(null);
	const [hasViewer, setHasViewer] = useState(false);
	const viewerRef = useRef<Mol3DViewer>(undefined);
	const server = useFoldServer();
	const [notice, setNotice] = useState("");
	const [serverOpen, setServerOpen] = useState(false);
	const [serverBusy, setServerBusy] = useState(false);
	const [editingJob, setEditingJob] = useState<Job | null>(null);
	const connection = server.connection;
	const refreshServer = server.refresh;

	const totalResidues = useMemo(
		() => inputs.reduce((sum, input) => sum + input.sequence.length, 0),
		[inputs],
	);
	const draftInvalid = invalidResidues(draft.type, cleanSequence(draft.sequence));

	const addDraft = useCallback(() => {
		const sequence = cleanSequence(draft.sequence);
		if (sequence === "") return false;
		if (invalidResidues(draft.type, sequence).length > 0) return false;
		setInputs((current) => appendChain(current, draft.type, sequence));
		setDraft((current) => ({ type: current.type, sequence: "" }));
		setError("");
		return true;
	}, [draft]);

	const updateChain = useCallback(
		(index: number, patch: Partial<Pick<PredictionInput, "type" | "sequence">>) => {
			setInputs((current) =>
				current.map((input, i) => {
					if (i !== index) return input;
					const type = patch.type ?? input.type;
					const sequence =
						patch.sequence === undefined ? input.sequence : cleanSequence(patch.sequence);
					return makeInput(type, sequence, input.id);
				}),
			);
		},
		[],
	);

	const removeChain = useCallback((index: number) => {
		setInputs((current) => relabelChains(current.filter((_, i) => i !== index)));
	}, []);

	const clearChains = useCallback(() => {
		setInputs([]);
		setError("");
	}, []);

	const addPreset = useCallback((preset: Preset) => {
		setInputs((current) => appendPreset(current, preset));
		setName(preset.name);
		setPresetsOpen(false);
		setError("");
	}, []);

	const queueChains = useCallback(
		async (chains: PredictionInput[], reason: string) => {
			if (!connection) return false;
			try {
				const job = await createJob(connection, { name: jobName(name), chains: toJobChains(chains) });
				const ahead = job.position ?? 0;
				setNotice(
					`${reason}Queued "${job.name}" on your fold server${ahead > 0 ? ` behind ${ahead} other job${ahead === 1 ? "" : "s"}` : ""}. Open My server to check on it or edit it.`,
				);
				refreshServer();
				return true;
			} catch (error) {
				setError(`Oops! ${reason}Your fold server could not queue it either. ${errorMessage(error)}`);
				return false;
			}
		},
		[connection, name, refreshServer],
	);

	const predict = useCallback(async () => {
		const chains = inputs.filter((input) => input.sequence !== "");
		const problem = checkChains(chains);
		if (problem) {
			setError(problem);
			return;
		}
		setError("");
		setNotice("");
		setLoading(true);
		const started = performance.now();
		try {
			if (exceedsApiLimits(chains)) {
				const reason = `This is too big for NVIDIA's API (at most ${API_MAX_CHAINS} chains of ${API_MAX_CHAIN_LENGTH} residues). `;
				if (!(await queueChains(chains, reason))) {
					if (!connection) setError(`${reason}Connect your own fold server (My server) to queue it there.`);
				}
				return;
			}
			const result = await predictStructure(model, relabelChains(chains));
			if (result.ok) {
				setStructure(result.structure);
				setLastRun({ durationMs: performance.now() - started, chains: chains.length, model });
			} else if (connection) {
				await queueChains(chains, `NVIDIA's API could not predict it: ${result.message} `);
			} else {
				setError(`Oops! The structure could not be predicted. ${result.message}`);
			}
		} catch {
			if (!connection || !(await queueChains(chains, "NVIDIA's API did not answer. "))) {
				setError(
					"Oops! The service could not predict the structure. It might be too long or invalid, or it could be a one off error, so please try again.",
				);
			}
		} finally {
			setLoading(false);
		}
	}, [inputs, model, connection, queueChains]);

	const queueCurrent = useCallback(async () => {
		const chains = inputs.filter((input) => input.sequence !== "");
		const problem = checkChains(chains);
		if (problem) {
			setError(problem);
			return;
		}
		setServerBusy(true);
		setNotice("");
		await queueChains(chains, "");
		setServerBusy(false);
	}, [inputs, queueChains]);

	const editJob = useCallback((job: Job) => {
		setInputs(relabelChains(job.chains.map((chain) => makeInput(chain.type, chain.sequence, chain.id))));
		setName(job.name);
		setEditingJob(job);
		setServerOpen(false);
		setError("");
		setNotice("");
	}, []);

	const cancelEdit = useCallback(() => setEditingJob(null), []);

	const saveJob = useCallback(async () => {
		if (!connection || !editingJob) return;
		const chains = inputs.filter((input) => input.sequence !== "");
		const problem = checkChains(chains);
		if (problem) {
			setError(problem);
			return;
		}
		setServerBusy(true);
		try {
			const job = await updateJob(connection, editingJob.id, { name: jobName(name), chains: toJobChains(chains) });
			setEditingJob(null);
			setNotice(`Saved your changes to "${job.name}". ${job.status === "queued" ? "It is back in the queue." : ""}`.trim());
			refreshServer();
		} catch (error) {
			setError(`Oops! Could not save the job. ${errorMessage(error)}`);
		} finally {
			setServerBusy(false);
		}
	}, [connection, editingJob, inputs, name, refreshServer]);

	const openJob = useCallback(
		async (job: Job) => {
			if (!connection) return;
			setServerBusy(true);
			try {
				const result = await getJobStructure(connection, job.id);
				setStructure({ text: result.text, format: "cif" });
				setName(job.name);
				const took =
					job.startedAt && job.finishedAt ? Date.parse(job.finishedAt) - Date.parse(job.startedAt) : 0;
				setLastRun({ durationMs: took, chains: job.chains.length, model: "boltz2" });
				setServerOpen(false);
			} catch (error) {
				setError(`Oops! Could not load the structure. ${errorMessage(error)}`);
			} finally {
				setServerBusy(false);
			}
		},
		[connection],
	);

	const removeJob = useCallback(
		async (job: Job) => {
			if (!connection) return;
			setServerBusy(true);
			try {
				await deleteJob(connection, job.id);
				setEditingJob((current) => (current?.id === job.id ? null : current));
				await refreshServer();
			} catch (error) {
				setError(`Oops! Could not delete the job. ${errorMessage(error)}`);
			} finally {
				setServerBusy(false);
			}
		},
		[connection, refreshServer],
	);

	const onViewer = useCallback((viewer: Mol3DViewer | undefined) => {
		viewerRef.current = viewer;
		setHasViewer(viewer !== undefined);
	}, []);

	const downloadPng = useCallback(() => {
		if (!viewerRef.current) return;
		download(viewerRef.current.pngURI(), `${fileSafeName(name)}.png`);
	}, [name]);

	const downloadStructure = useCallback(() => {
		if (structure === null) return;
		const type = structure.format === "cif" ? "chemical/x-mmcif" : "chemical/x-pdb";
		const url = URL.createObjectURL(new Blob([structure.text], { type }));
		download(url, `${fileSafeName(name)}.${structure.format}`);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}, [structure, name]);

	const structureExtension = structure?.format ?? (model === "openfold3" ? "pdb" : "cif");

	return {
		inputs,
		draft,
		setDraft,
		draftInvalid,
		loading,
		error,
		setError,
		structure,
		structureExtension,
		model,
		setModel,
		name,
		setName,
		presetsOpen,
		setPresetsOpen,
		viewerStyle,
		setViewerStyle,
		lastRun,
		hasViewer,
		totalResidues,
		addDraft,
		updateChain,
		removeChain,
		clearChains,
		addPreset,
		predict,
		server,
		notice,
		setNotice,
		serverOpen,
		setServerOpen,
		serverBusy,
		editingJob,
		queueCurrent,
		editJob,
		cancelEdit,
		saveJob,
		openJob,
		removeJob,
		onViewer,
		downloadPng,
		downloadStructure,
	};
}

/** Everything the views get from {@link usePredictor}. */
export type Predictor = ReturnType<typeof usePredictor>;
