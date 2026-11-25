"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoleculeViewer } from "./molecule-viewer";
import { useModal } from "./use-modal";
import { MODEL_LABELS, Predictor } from "./use-predictor";
import { useTheme } from "./theme";
import {
	ErrorIcon,
	HelixIcon,
	InfoIcon,
	Menu,
	MenuItem,
	MenuBar,
	TitleBar,
} from "./win98";
import { Preset, invalidResidues } from "@/utils/chains";
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

const APP_TITLE = "Genetic Fold Predictor";

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
			className="w98-field w-22 shrink-0"
		>
			<option value="protein">Protein</option>
			<option value="dna">DNA</option>
		</select>
	);
}

function DialogWindow({
	title,
	open,
	onClose,
	children,
	width,
	locked,
}: {
	title: string;
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	width: string;
	locked?: boolean;
}) {
	const [modalRef] = useModal(open, onClose);
	return (
		<dialog
			ref={modalRef}
			className="w98-dialog"
			onCancel={(event) => {
				if (locked) event.preventDefault();
			}}
		>
			<div className="w98-window" style={{ width }}>
				<TitleBar title={title} onClose={locked ? undefined : onClose} />
				<div className="p-2">{children}</div>
			</div>
		</dialog>
	);
}

function PresetDialog({ p }: { p: Predictor }) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Preset | null>(null);
	const presets = searchPresets(query);
	const close = () => p.setPresetsOpen(false);

	return (
		<DialogWindow title="Load Preset" open={p.presetsOpen} onClose={close} width="min(480px, calc(100vw - 16px))">
			<div className="flex flex-col gap-2">
				<label className="flex flex-row items-center gap-2">
					<span>
						<u>F</u>ind:
					</span>
					<input
						type="text"
						data-autofocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="w98-field flex-1"
					/>
				</label>
				<div className="w98-sunken bg-white">
					<div className="grid grid-cols-[1fr_auto] bg-[var(--w98-face)]">
						<span className="w98-btn !min-w-0 !px-1 text-left">Name</span>
						<span className="w98-btn !min-w-0 !px-1 text-left w-36">Size</span>
					</div>
					<ul role="listbox" aria-label="Presets" className="h-64 overflow-y-auto">
						{presets.map((preset) => {
							const isSelected = selected?.name === preset.name;
							return (
								<li key={preset.name} role="option" aria-selected={isSelected}>
									<button
										className={`w98-list-item w-full grid grid-cols-[1fr_auto] gap-2 ${isSelected ? "!bg-[var(--w98-select)] !text-white" : ""}`}
										onClick={() => setSelected(preset)}
										onDoubleClick={() => p.addPreset(preset)}
									>
										<span className="truncate">{preset.name}</span>
										<span className="w-34 truncate">{presetSummary(preset)}</span>
									</button>
								</li>
							);
						})}
						{presets.length === 0 && <li className="p-2 text-[var(--w98-shadow)]">No presets match.</li>}
					</ul>
				</div>
				<p className="text-[var(--w98-shadow)] min-h-4">
					{selected ? `Source: ${selected.from}` : `${presets.length} preset${presets.length === 1 ? "" : "s"}`}
				</p>
				<div className="flex flex-row justify-end gap-2">
					<button className="w98-btn w98-btn-default" disabled={selected === null} onClick={() => selected && p.addPreset(selected)}>
						OK
					</button>
					<button className="w98-btn" onClick={close}>
						Cancel
					</button>
				</div>
			</div>
		</DialogWindow>
	);
}

function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<DialogWindow title={`About ${APP_TITLE}`} open={open} onClose={onClose} width="min(380px, calc(100vw - 16px))">
			<div className="flex flex-row gap-3 p-2">
				<HelixIcon size={32} />
				<div className="flex flex-col gap-2">
					<p className="font-bold">{APP_TITLE}</p>
					<p>Version 98.0 (Second Edition)</p>
					<p>Copyright (C) Mooshay105. Licensed under the GNU GPL 3.0.</p>
					<hr className="border-t border-[var(--w98-shadow)] border-b-white" />
					<p>Structure prediction: Boltz-2 and OpenFold3 via NVIDIA BioNeMo.</p>
					<p>Molecular graphics: 3Dmol.js.</p>
				</div>
			</div>
			<div className="flex flex-row justify-end gap-2 pt-2">
				<Link href="/credits" className="w98-btn inline-flex items-center justify-center">
					Credits...
				</Link>
				<button className="w98-btn w98-btn-default" onClick={onClose}>
					OK
				</button>
			</div>
		</DialogWindow>
	);
}

function ErrorDialog({ p }: { p: Predictor }) {
	const close = () => p.setError("");
	return (
		<DialogWindow title={APP_TITLE} open={p.error !== ""} onClose={close} width="min(400px, calc(100vw - 16px))">
			<div className="flex flex-row gap-4 items-start p-2">
				<ErrorIcon />
				<p className="pt-1 min-w-0 max-h-60 overflow-y-auto [overflow-wrap:anywhere]">{p.error}</p>
			</div>
			<div className="flex justify-center pt-2">
				<button className="w98-btn w98-btn-default" onClick={close} data-autofocus>
					OK
				</button>
			</div>
		</DialogWindow>
	);
}

function ProgressDialog({ p }: { p: Predictor }) {
	return (
		<DialogWindow title="Predicting Structure" open={p.loading} onClose={() => {}} width="min(360px, calc(100vw - 16px))" locked>
			<div className="flex flex-row gap-3 items-start p-2">
				<InfoIcon />
				<div className="flex flex-col gap-1">
					<p>
						Folding {p.inputs.length} chain{p.inputs.length === 1 ? "" : "s"} ({p.totalResidues} residues) with {MODEL_LABELS[p.model]}...
					</p>
					<p className="text-[var(--w98-shadow)]">This may take a few minutes. Please do not turn off your computer.</p>
				</div>
			</div>
			<div className="w98-progress mx-2 mb-2">
				<span />
			</div>
		</DialogWindow>
	);
}

export function Win98View({ p }: { p: Predictor }) {
	const { setTheme } = useTheme();
	const router = useRouter();
	const [aboutOpen, setAboutOpen] = useState(false);
	const exit = () => setTheme("modern");
	const style = p.viewerStyle;
	const busy = p.loading;

	const menus: Menu[] = [
		{
			label: "File",
			items: [
				{ label: "Load Preset...", hint: "Ctrl+O", onSelect: () => p.setPresetsOpen(true), disabled: busy },
				{ separator: true },
				{ label: "Export Image (PNG)", onSelect: p.downloadPng, disabled: !p.hasViewer },
				{ label: `Export Structure (${p.structureExtension.toUpperCase()})`, onSelect: p.downloadStructure, disabled: p.structure === null },
				{ separator: true },
				{ label: "Exit", hint: "Alt+F4", onSelect: exit },
			],
		},
		{
			label: "Edit",
			items: [
				{ label: "Clear All Chains", onSelect: p.clearChains, disabled: busy || p.inputs.length === 0 },
			],
		},
		{
			label: "Display",
			items: [
				...(Object.entries(REPRESENTATION_LABELS) as [Representation, string][]).map(
					([value, label]): MenuItem => ({
						label,
						kind: "radio",
						checked: style.representation === value,
						onSelect: () => p.setViewerStyle({ ...style, representation: value }),
					}),
				),
				{ separator: true },
				...(Object.entries(COLOR_LABELS) as [ColorScheme, string][]).map(
					([value, label]): MenuItem => ({
						label: `Colour: ${label}`,
						kind: "radio",
						checked: style.color === value,
						onSelect: () => p.setViewerStyle({ ...style, color: value }),
					}),
				),
				{ separator: true },
				{ label: "Spin", kind: "check", checked: style.spin, onSelect: () => p.setViewerStyle({ ...style, spin: !style.spin }) },
			],
		},
		{
			label: "Run",
			items: [
				{ label: "Predict & Render", hint: "F5", onSelect: p.predict, disabled: busy || p.inputs.length === 0 },
				{ separator: true },
				...(Object.entries(MODEL_LABELS) as [Model, string][]).map(
					([value, label]): MenuItem => ({
						label: `Use ${label}`,
						kind: "radio",
						checked: p.model === value,
						disabled: busy,
						onSelect: () => p.setModel(value),
					}),
				),
			],
		},
		{
			label: "Help",
			items: [
				{ label: "Credits", onSelect: () => router.push("/credits") },
				{ separator: true },
				{ label: `About ${APP_TITLE}...`, onSelect: () => setAboutOpen(true) },
			],
		},
	];

	const shortcuts = useRef({ predict: () => {}, openPresets: () => {} });
	useEffect(() => {
		shortcuts.current = {
			predict: () => {
				if (!busy && p.inputs.length > 0) p.predict();
			},
			openPresets: () => {
				if (!busy) p.setPresetsOpen(true);
			},
		};
	});
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "F5") {
				event.preventDefault();
				shortcuts.current.predict();
			}
			if (event.ctrlKey && event.key.toLowerCase() === "o") {
				event.preventDefault();
				shortcuts.current.openPresets();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	return (
		<div className="w98-window h-dvh flex flex-col overflow-hidden">
			<MenuBar menus={menus} />
			<div className="flex flex-row flex-wrap gap-1 py-1 border-y border-t-[var(--w98-shadow)] border-b-white">
				<button className="w98-btn" onClick={p.downloadPng} disabled={!p.hasViewer}>
					Save PNG
				</button>
				<button className="w98-btn" onClick={p.downloadStructure} disabled={p.structure === null}>
					Save {p.structureExtension.toUpperCase()}
				</button>
			</div>

			<div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 p-1 pt-2 overflow-y-auto md:overflow-hidden">
				<div className="md:w-[38%] md:min-w-80 md:max-w-xl flex flex-col gap-2 md:min-h-0 order-2 md:order-1">
					<fieldset className="w98-groupbox flex flex-col md:flex-1 md:min-h-0">
						<legend>Chains</legend>
						<div className="w98-sunken bg-white flex flex-col md:flex-1 md:min-h-0">
							<div className="grid grid-cols-[2.5rem_5.5rem_1fr_3.5rem_1.75rem] bg-[var(--w98-face)]">
								<span className="w98-btn !min-w-0 !px-1 text-left">ID</span>
								<span className="w98-btn !min-w-0 !px-1 text-left">Type</span>
								<span className="w98-btn !min-w-0 !px-1 text-left">Sequence</span>
								<span className="w98-btn !min-w-0 !px-1 text-left">Length</span>
								<span className="w98-btn !min-w-0 !px-1" />
							</div>
							<ol className="max-h-64 md:max-h-none md:flex-1 overflow-y-auto">
								{p.inputs.length === 0 && (
									<li className="p-2 text-[var(--w98-shadow)]">(none) - use File &gt; Load Preset or add a chain below.</li>
								)}
								{p.inputs.map((input, index) => {
									const bad = invalidResidues(input.type, input.sequence);
									return (
										<li key={index} className="grid grid-cols-[2.5rem_5.5rem_1fr_3.5rem_1.75rem] items-center gap-0 px-0.5 py-px">
											<span className="px-1 font-bold">{input.id}</span>
											<TypeSelect label={`Chain ${input.id} type`} value={input.type} disabled={busy} onChange={(type) => p.updateChain(index, { type })} />
											<input
												aria-label={`Chain ${input.id} sequence`}
												aria-invalid={bad.length > 0}
												title={bad.length > 0 ? `Not valid ${input.type === "dna" ? "DNA" : "protein"}: ${bad.join(" ")}` : undefined}
												type="text"
												value={input.sequence}
												disabled={busy}
												onChange={(event) => p.updateChain(index, { sequence: event.target.value })}
												className="w98-field min-w-0 ml-1 font-mono"
											/>
											<span className={`px-1 text-right ${bad.length > 0 ? "text-[#a00000]" : ""}`}>{input.sequence.length}</span>
											<button className="w98-titlebar-button !w-5 !h-[18px] mx-auto" aria-label={`Remove chain ${input.id}`} disabled={busy} onClick={() => p.removeChain(index)}>
												<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
													<path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" />
												</svg>
											</button>
										</li>
									);
								})}
							</ol>
						</div>
					</fieldset>

					<fieldset className="w98-groupbox">
						<legend>Add chain</legend>
						<form
							className="flex flex-row gap-1"
							onSubmit={(event) => {
								event.preventDefault();
								p.addDraft();
							}}
						>
							<TypeSelect label="New chain type" value={p.draft.type} disabled={busy} onChange={(type) => p.setDraft({ ...p.draft, type })} />
							<input
								aria-label="New chain sequence"
								aria-invalid={p.draftInvalid.length > 0}
								type="text"
								value={p.draft.sequence}
								disabled={busy}
								onChange={(event) => p.setDraft({ ...p.draft, sequence: event.target.value })}
								placeholder={p.draft.type === "dna" ? "ACGT..." : "MGREE..."}
								className="w98-field flex-1 min-w-0 font-mono"
							/>
							<button type="submit" className="w98-btn !min-w-0" disabled={busy || p.draft.sequence.trim() === "" || p.draftInvalid.length > 0}>
								<u>A</u>dd
							</button>
						</form>
						{p.draftInvalid.length > 0 && (
							<p className="text-[#a00000] pt-1">Not valid {p.draft.type === "dna" ? "DNA" : "protein"}: {p.draftInvalid.join(" ")}</p>
						)}
					</fieldset>

					<div className="flex flex-row flex-wrap gap-2 justify-end items-center">
						<label className="flex items-center gap-1 mr-auto">
							<span>
								<u>M</u>odel:
							</span>
							<select className="w98-field" value={p.model} disabled={busy} onChange={(event) => p.setModel(event.target.value as Model)}>
								{Object.entries(MODEL_LABELS).map(([value, label]) => (
									<option key={value} value={value}>{label}</option>
								))}
							</select>
						</label>
						<button className="w98-btn" onClick={() => p.setPresetsOpen(true)} disabled={busy}>
							Load Preset...
						</button>
						<button className="w98-btn w98-btn-default" onClick={p.predict} disabled={busy || p.inputs.length === 0}>
							Predict &amp; Render
						</button>
					</div>
				</div>

				<div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0 order-1 md:order-2">
					<div className="w98-sunken flex-1 min-h-0 h-[50vh] md:h-auto">
						<div className="relative w-full h-full bg-black">
							{p.structure !== null && (
								<MoleculeViewer
									structure={p.structure}
									background={VIEWER_BACKGROUND.win98}
									viewerStyle={style}
									onViewer={p.onViewer}
									className="absolute inset-0"
								/>
							)}
							{p.structure === null && (
								<pre className="absolute inset-0 p-3 text-[#00ff00] font-mono text-xs whitespace-pre-wrap">
									{`Fold98 Molecular Viewer\n\nNo structure loaded.\n\n> Add chains on the left, then choose Run > Predict & Render (F5).\n> ${busy ? "Folding, please wait..." : "Ready."}`}
								</pre>
							)}
						</div>
					</div>
					<fieldset className="w98-groupbox">
						<legend>Display</legend>
						<div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2">
							<label className="flex items-center gap-1">
								Style:
								<select
									className="w98-field"
									value={style.representation}
									onChange={(event) => p.setViewerStyle({ ...style, representation: event.target.value as Representation })}
								>
									{Object.entries(REPRESENTATION_LABELS).map(([value, label]) => (
										<option key={value} value={value}>{label}</option>
									))}
								</select>
							</label>
							<label className="flex items-center gap-1">
								Colour:
								<select
									className="w98-field"
									value={style.color}
									onChange={(event) => p.setViewerStyle({ ...style, color: event.target.value as ColorScheme })}
								>
									{Object.entries(COLOR_LABELS).map(([value, label]) => (
										<option key={value} value={value}>{label}</option>
									))}
								</select>
							</label>
							<label className="flex items-center gap-1">
								<input type="checkbox" checked={style.spin} onChange={(event) => p.setViewerStyle({ ...style, spin: event.target.checked })} />
								Spin
							</label>
							<label className="flex items-center gap-1 flex-1 min-w-40">
								File name:
								<input type="text" className="w98-field flex-1 min-w-0" value={p.name} onChange={(event) => p.setName(event.target.value)} />
							</label>
						</div>
					</fieldset>
				</div>
			</div>

			<div className="w98-statusbar">
				<span className="flex-1">
					{busy ? "Predicting..." : p.lastRun && p.structure !== null ? `Done. ${MODEL_LABELS[p.lastRun.model]} took ${(p.lastRun.durationMs / 1000).toFixed(1)} s.` : "Ready"}
				</span>
				<span className="w-44">
					{p.inputs.length} chain{p.inputs.length === 1 ? "" : "s"}, {p.totalResidues} residues
				</span>
				<span className="w-20 hidden sm:block">{MODEL_LABELS[p.model]}</span>
			</div>

			<PresetDialog p={p} />
			<AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
			<ErrorDialog p={p} />
			<ProgressDialog p={p} />
		</div>
	);
}
