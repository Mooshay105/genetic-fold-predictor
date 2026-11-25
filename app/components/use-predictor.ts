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
import { MoleculeType, PredictionInput } from "@/utils/types";
import { DEFAULT_VIEWER_STYLE, ViewerStyle } from "@/utils/viewer-style";

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

	const predict = useCallback(async () => {
		const chains = inputs.filter((input) => input.sequence !== "");
		if (chains.length === 0) {
			setError("Add at least one protein or DNA sequence first.");
			return;
		}
		const bad = chains.find((input) => invalidResidues(input.type, input.sequence).length > 0);
		if (bad) {
			setError(`Chain ${bad.id} has letters that are not valid ${bad.type === "dna" ? "DNA" : "protein"}.`);
			return;
		}
		const short = chains.find((input) => input.sequence.length < MIN_SEQUENCE_LENGTH);
		if (short) {
			setError(`Chain ${short.id} is too short. OpenFold3 needs at least ${MIN_SEQUENCE_LENGTH} letters.`);
			return;
		}
		setError("");
		setLoading(true);
		const started = performance.now();
		try {
			const result = await predictStructure(model, relabelChains(chains));
			if (result.ok) {
				setStructure(result.structure);
				setLastRun({ durationMs: performance.now() - started, chains: chains.length, model });
			} else {
				setError(`Oops! The structure could not be predicted. ${result.message}`);
			}
		} catch {
			setError(
				"Oops! The service could not predict the structure. It might be too long or invalid, or it could be a one off error, so please try again.",
			);
		} finally {
			setLoading(false);
		}
	}, [inputs, model]);

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
		onViewer,
		downloadPng,
		downloadStructure,
	};
}

/** Everything the views get from {@link usePredictor}. */
export type Predictor = ReturnType<typeof usePredictor>;
