"use client";

import Link from "next/link";
import { useState } from "react";
import { MoleculeViewer } from "./molecule-viewer";
import { useModal } from "./use-modal";
import { MODEL_LABELS, Predictor } from "./use-predictor";
import { useTheme } from "./theme";
import { invalidResidues } from "@/utils/chains";
import { presetSummary, searchPresets } from "@/utils/presets";
import { Model } from "@/utils/actions";
import { VIEWER_BACKGROUND } from "@/utils/theme";
import { MoleculeType } from "@/utils/types";
import {
	COLOR_LABELS,
	ColorScheme,
	REPRESENTATION_LABELS,
	Representation,
} from "@/utils/viewer-style";

const control =
	"border border-line rounded px-2 py-1 bg-background disabled:opacity-40 disabled:cursor-not-allowed";
const button = `${control} hover:bg-line/10 active:bg-line/20 whitespace-nowrap cursor-pointer`;

function unit(type: MoleculeType) {
	return type === "dna" ? "nt" : "aa";
}

function CrossIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			aria-hidden
		>
			<path d="M6 6L18 18M6 18L18 6" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			aria-hidden
		>
			<path d="M12 5V19M5 12H19" />
		</svg>
	);
}

function TypeSelect({
	value,
	onChange,
	disabled,
	label,
}: {
	value: MoleculeType;
	onChange: (type: MoleculeType) => void;
	disabled?: boolean;
	label: string;
}) {
	return (
		<select
			aria-label={label}
			value={value}
			disabled={disabled}
			onChange={(event) => onChange(event.target.value as MoleculeType)}
			className={`${control} w-24 shrink-0`}
		>
			<option value="protein">Protein</option>
			<option value="dna">DNA</option>
		</select>
	);
}

function PresetDialog({ p }: { p: Predictor }) {
	const [query, setQuery] = useState("");
	const [modalRef, onBackdropClick] = useModal(p.presetsOpen, () =>
		p.setPresetsOpen(false),
	);
	const presets = searchPresets(query);

	return (
		<dialog
			ref={modalRef}
			onClick={onBackdropClick}
			className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[80vh] border-2 border-line rounded-2xl bg-background text-font-color p-0 backdrop:bg-black/70"
		>
			<div className="flex flex-col max-h-[80vh] p-3 gap-2">
				<div className="flex flex-row justify-between items-center">
					<h2 className="text-xl font-bold">Protein Preset Selector</h2>
					<button
						onClick={() => p.setPresetsOpen(false)}
						aria-label="Close"
						className="rounded p-1 hover:bg-line/10 cursor-pointer"
					>
						<CrossIcon />
					</button>
				</div>
				<input
					type="search"
					data-autofocus
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search presets, e.g. insulin or E. coli"
					className={control}
				/>
				<ul className="overflow-y-auto flex flex-col gap-1 pr-1">
					{presets.map((preset) => (
						<li key={preset.name}>
							<button
								onClick={() => p.addPreset(preset)}
								className="w-full text-left rounded px-2 py-1 hover:bg-line/10 focus-visible:bg-line/10 flex flex-row justify-between gap-4 cursor-pointer"
							>
								<span>{preset.name}</span>
								<span className="text-secondary-font-color whitespace-nowrap">
									{presetSummary(preset)} · {preset.from}
								</span>
							</button>
						</li>
					))}
					{presets.length === 0 && (
						<li className="text-secondary-font-color px-2 py-4 text-center">
							No presets match “{query}”.
						</li>
					)}
				</ul>
			</div>
		</dialog>
	);
}

export function ModernView({ p }: { p: Predictor }) {
	const { setTheme } = useTheme();

	return (
		<main className="flex flex-col md:flex-row md:h-dvh">
			<aside className="md:w-1/3 md:min-w-80 md:max-w-xl flex flex-col border-t-2 md:border-r-2 border-line rounded-tr-2xl md:min-h-0 order-2 md:order-1">
				<div className="flex flex-row items-baseline justify-between gap-2 px-3 pt-2">
					<h1 className="text-2xl font-bold">Proteins and DNA</h1>
					{p.inputs.length > 0 && (
						<button
							onClick={p.clearChains}
							disabled={p.loading}
							className="text-secondary-font-color underline hover:text-font-color disabled:opacity-40 cursor-pointer"
						>
							Clear all
						</button>
					)}
				</div>
				<p className="px-3 text-secondary-font-color text-sm">
					{p.inputs.length === 0
						? "No chains yet."
						: `${p.inputs.length} chain${p.inputs.length === 1 ? "" : "s"}, ${p.totalResidues} residues`}
				</p>

				<ol className="flex flex-col gap-2 px-3 py-2 md:flex-1 md:overflow-y-auto">
					{p.inputs.length === 0 && (
						<li className="text-[#5a5a5a] text-center my-auto py-8">
							Type a sequence below, or press Load Preset to try an example.
						</li>
					)}
					{p.inputs.map((input, index) => {
						const bad = invalidResidues(input.type, input.sequence);
						return (
							<li key={index} className="flex flex-col gap-1">
								<div className="flex flex-row gap-2 items-center">
									<span
										className="w-7 h-7 shrink-0 rounded-full border border-line flex items-center justify-center font-bold"
										title={`Chain ${input.id}`}
									>
										{input.id}
									</span>
									<TypeSelect
										label={`Chain ${input.id} type`}
										value={input.type}
										disabled={p.loading}
										onChange={(type) => p.updateChain(index, { type })}
									/>
									<input
										aria-label={`Chain ${input.id} sequence`}
										type="text"
										value={input.sequence}
										disabled={p.loading}
										onChange={(event) =>
											p.updateChain(index, { sequence: event.target.value })
										}
										className={`${control} w-full min-w-0 ${bad.length > 0 ? "border-red-400" : ""}`}
									/>
									<button
										onClick={() => p.removeChain(index)}
										disabled={p.loading}
										aria-label={`Remove chain ${input.id}`}
										className={`${button} p-1`}
									>
										<CrossIcon />
									</button>
								</div>
								<p className="text-xs text-secondary-font-color pl-9">
									{input.sequence.length} {unit(input.type)}
									{bad.length > 0 && (
										<span className="text-red-400">
											{" "}
											· not valid {input.type === "dna" ? "DNA" : "protein"}:{" "}
											{bad.join(" ")}
										</span>
									)}
								</p>
							</li>
						);
					})}
				</ol>

				<div className="flex flex-col gap-2 px-3 pb-3 pt-2 border-t border-line/25">
					{p.error && (
						<p
							role="alert"
							className="text-red-400 border border-red-400/60 rounded px-2 py-1 text-sm max-h-40 overflow-y-auto [overflow-wrap:anywhere]"
						>
							{p.error}
						</p>
					)}
					<form
						className="flex flex-row gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							p.addDraft();
						}}
					>
						<TypeSelect
							label="New chain type"
							value={p.draft.type}
							disabled={p.loading}
							onChange={(type) => p.setDraft({ ...p.draft, type })}
						/>
						<input
							aria-label="New chain sequence"
							type="text"
							value={p.draft.sequence}
							disabled={p.loading}
							onChange={(event) =>
								p.setDraft({ ...p.draft, sequence: event.target.value })
							}
							placeholder={p.draft.type === "dna" ? "ACGT..." : "MGREE..."}
							className={`${control} w-full min-w-0 ${p.draftInvalid.length > 0 ? "border-red-400" : ""}`}
						/>
						<button
							type="submit"
							disabled={
								p.loading || p.draft.sequence.trim() === "" || p.draftInvalid.length > 0
							}
							aria-label="Add chain"
							className={`${button} p-1`}
						>
							<PlusIcon />
						</button>
					</form>
					{p.draftInvalid.length > 0 && (
						<p className="text-xs text-red-400">
							Not valid {p.draft.type === "dna" ? "DNA" : "protein"}:{" "}
							{p.draftInvalid.join(" ")}
						</p>
					)}
					<label className="flex flex-row items-center gap-2 text-sm text-secondary-font-color">
						<select
							value={p.model}
							disabled={p.loading}
							onChange={(event) => p.setModel(event.target.value as Model)}
							className={`${control} flex-1 text-font-color`}
						>
							{Object.entries(MODEL_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					<div className="flex flex-row gap-2">
						<button
							onClick={() => p.setPresetsOpen(true)}
							disabled={p.loading}
							className={`${button} flex-1`}
						>
							Load Preset
						</button>
						<button
							onClick={p.predict}
							disabled={p.loading || p.inputs.length === 0}
							className="flex-1 rounded px-2 py-1 bg-line text-background font-bold hover:bg-line/85 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
						>
							{p.loading ? "Predicting..." : "Predict & Render"}
						</button>
					</div>
				</div>
			</aside>

			<section className="flex-1 flex flex-col min-w-0 order-1 md:order-2">
				<div className="relative flex-1 h-[55vh] md:h-auto min-h-0">
					{p.structure !== null && (
						<MoleculeViewer
							structure={p.structure}
							background={VIEWER_BACKGROUND.modern}
							viewerStyle={p.viewerStyle}
							onViewer={p.onViewer}
							className="absolute inset-0"
						/>
					)}
					{p.structure === null && !p.loading && (
						<div className="absolute inset-0 flex flex-col items-center justify-center text-[#3d3d3d] gap-1 text-center px-4">
							<p className="text-2xl">Protein Will Appear Here.</p>
							<p>Add chains on the left, then press Predict & Render.</p>
						</div>
					)}
					{p.loading && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
							<div className="w-10 h-10 rounded-full border-4 border-line/20 border-t-line animate-spin" />
							<p className="text-secondary-font-color">
								Folding {p.inputs.length === 1 ? "1 chain" : `${p.inputs.length} chains`}{" "}
								with {MODEL_LABELS[p.model]}, this can take a few minutes...
							</p>
						</div>
					)}
					{p.lastRun && !p.loading && p.structure !== null && (
						<p className="absolute top-2 right-3 text-xs text-secondary-font-color pointer-events-none">
							{MODEL_LABELS[p.lastRun.model]}, {(p.lastRun.durationMs / 1000).toFixed(1)}{" "}
							s
						</p>
					)}
				</div>

				<div className="flex flex-col gap-2 border-t-2 md:border-r-2 border-line bg-background p-2 rounded-tr-2xl">
					<div className="flex flex-row flex-wrap gap-2 items-center">
						<select
							aria-label="Representation"
							value={p.viewerStyle.representation}
							onChange={(event) =>
								p.setViewerStyle({
									...p.viewerStyle,
									representation: event.target.value as Representation,
								})
							}
							className={control}
						>
							{Object.entries(REPRESENTATION_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
						<select
							aria-label="Colour"
							value={p.viewerStyle.color}
							onChange={(event) =>
								p.setViewerStyle({
									...p.viewerStyle,
									color: event.target.value as ColorScheme,
								})
							}
							className={control}
						>
							{Object.entries(COLOR_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
						<label className="flex flex-row items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={p.viewerStyle.spin}
								onChange={(event) =>
									p.setViewerStyle({ ...p.viewerStyle, spin: event.target.checked })
								}
								className="accent-line"
							/>
							Spin
						</label>
						<button
							onClick={() => setTheme("win98")}
							className="ml-auto underline px-1 whitespace-nowrap text-secondary-font-color hover:text-font-color cursor-pointer"
							title="Switch to the Windows 98 look"
						>
							Win 98
						</button>
					</div>
					<div className="flex flex-row flex-wrap gap-2 items-center">
						<input
							aria-label="File name"
							type="text"
							value={p.name}
							onChange={(event) => p.setName(event.target.value)}
							placeholder="protein"
							className={`${control} flex-1 min-w-20`}
						/>
						<button onClick={p.downloadPng} disabled={!p.hasViewer} className={button}>
							Download PNG
						</button>
						<button
							onClick={p.downloadStructure}
							disabled={p.structure === null}
							className={button}
						>
							Download {p.structureExtension.toUpperCase()}
						</button>
						<Link href="/credits" className="underline px-1 whitespace-nowrap">
							Credits
						</Link>
					</div>
				</div>
			</section>

			<PresetDialog p={p} />
		</main>
	);
}
