"use client";

import { useRef, useState } from "react";
import proteinPresets from "../public/protein-presets.json";
import Script from "next/script";
import { getProteinPDBData } from "@/utils/actions";
import { PredictionInput } from "@/utils/types";

export default function Home() {
	const [predictionInputs, setPredictionInputs] = useState<PredictionInput[]>([]);

	const [newPredictionInput, setNewPredictionInput] = useState<{
		type: "protein" | "dna";
		sequence: string;
	}>({
		type: "protein",
		sequence: "",
	});

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [pdb, setPDB] = useState<string | null>(null);
	const [viewer, setViewer] = useState<Mol3DViewer>();
	const [name, setName] = useState<string>("protein");
	const [shouldShowPresetSelector, showPresetSelector] = useState(false);
	const viewerRef = useRef<HTMLDivElement>(null);

	function getNewID(id: string) {
		if (id === "Z") return "A";
		if (id === "z") return "a";

		return String.fromCharCode(id.charCodeAt(0) + 1);
	}

	function addNewPredictionInput() {
		if (newPredictionInput.sequence.trim() === "") return;
		const newPredictionInputs = [...predictionInputs];
		console.log();
		newPredictionInputs.push({
			type: newPredictionInput.type,
			sequence: newPredictionInput.sequence.trim(),
			id:
				newPredictionInputs.length === 0
					? "A"
					: getNewID(newPredictionInputs[newPredictionInputs.length - 1].id),
			msa: {
				main_db: {
					csv: {
						alignment: `key,sequence\n-1,${newPredictionInput.sequence.trim()}`,
						format: "csv",
					},
				},
			},
			output_format: "pdb",
		});
		setPredictionInputs(newPredictionInputs);
		setNewPredictionInput({
			type: "protein",
			sequence: "",
		});
	}

	function removePredictionInput(index: number) {
		const newPredictionInputs: PredictionInput[] = [];
		predictionInputs.forEach((predictionInput, i) => {
			if (i !== index) {
				newPredictionInputs.push(predictionInput);
			}
		});
		setPredictionInputs(newPredictionInputs);
	}

	function downloadImg() {
		if (viewer === undefined) return;
		let imageData = viewer.pngURI();
		let link = document.createElement("a");
		link.href = imageData;
		link.download = `${name}.png`;
		link.click();
	}

	function downloadPDB() {
		if (viewer === undefined) return;
		if (pdb === null) return;
		let blob = new Blob([pdb], { type: "text/plain" });
		let link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `${name}.pdb`;
		link.click();
	}

	async function handlePredict() {
		if (predictionInputs.length === 0 || predictionInputs[0].sequence === "") {
			setError("Please Provide A DNA Sequence.");
			return;
		}
		setError("");
		setLoading(true);

		try {
			const pdbData = await getProteinPDBData(predictionInputs);

			if (!viewerRef.current || !window.$3Dmol) return;

			viewerRef.current.innerHTML = "";
			const viewer = window.$3Dmol.createViewer(viewerRef.current, {
				backgroundColor: "#121212",
			}) as Mol3DViewer;

			viewer.addModel(pdbData, "pdb");
			viewer.setStyle({}, { cartoon: { color: "spectrum" } });
			viewer.zoomTo();
			viewer.render();
			setPDB(pdbData);
			setViewer(viewer);
		} catch (err) {
			setError(
				"Oops! The service could not predict the proteins structure! It might be too long/invalid. Or there is just a one off error, so please try again.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex flex-col text-center justify-center">
			<div className="fixed top-0 left-0 w-1/3 h-full border-r-2 border-t-2 border-amber-50 bg-background p-2 flex flex-col justify-between overflow-scroll rounded-tr-2xl">
				<div>
					<Script
						src="https://3Dmol.org/build/3Dmol-min.js"
						strategy="beforeInteractive"
					/>
					<h1 className="text-2xl font-bold">Proteins and DNA:</h1>
					<div className={`flex flex-col gap-2 ${error ? "mb-13" : "mb-8"}`}>
						{predictionInputs.map((predictionInput, index) => (
							<div key={index} className="flex flex-row gap-2">
								<select
									id="type"
									value={predictionInputs[index].type}
									onChange={(event) => {
										const newPredictionInputs = [...predictionInputs];
										newPredictionInputs[index].type = event.target.value as
											| "protein"
											| "dna";
										setPredictionInputs(newPredictionInputs);
									}}
									className="border border-white w-min mx-auto rounded px-2"
								>
									<option value="protein">Protein</option>
									<option value="dna">DNA</option>
								</select>
								<input
									id="singleLetterAminoAcidChain"
									type="text"
									value={predictionInputs[index].sequence}
									onChange={(event) => {
										const newPredictionInputs = [...predictionInputs];
										newPredictionInputs[index].sequence = event.target.value;
										newPredictionInputs[index].msa = {
											main_db: {
												csv: {
													alignment: `key,sequence\n-1,${event.target.value}`,
													format: "csv",
												},
											},
										};
										setPredictionInputs(newPredictionInputs);
									}}
									placeholder="ISES"
									className="border border-white w-full mx-auto rounded px-2"
								/>
								<button
									onClick={() => {
										removePredictionInput(index);
									}}
									disabled={loading}
									className="border border-white mx-auto rounded p-1 whitespace-nowrap"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										width="24"
										height="24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M6 6L18 18M6 18L18 6" />
									</svg>
								</button>
							</div>
						))}
					</div>
					<div className="fixed bottom-0 left-0 bg-background w-1/3 border-r-2 border-amber-50 px-2">
						{error && <p style={{ color: "red" }}>{error}</p>}
						<div className="flex flex-row gap-2 mt-2">
							<select
								id="type"
								value={newPredictionInput.type}
								onChange={(event) => {
									setNewPredictionInput({
										type: event.target.value as "protein" | "dna",
										sequence: newPredictionInput.sequence,
									});
								}}
								className="border border-white w-min mx-auto rounded px-2"
							>
								<option value="protein">Protein</option>
								<option value="dna">DNA</option>
							</select>
							<input
								id="singleLetterAminoAcidChain"
								type="text"
								value={newPredictionInput.sequence}
								onChange={(event) => {
									setNewPredictionInput({
										type: newPredictionInput.type,
										sequence: event.target.value,
									});
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										addNewPredictionInput();
									}
								}}
								placeholder="ISES"
								className="border border-white w-full mx-auto rounded px-2"
							/>
							<button
								onClick={() => {
									addNewPredictionInput();
								}}
								disabled={loading}
								className="border border-white mx-auto rounded whitespace-nowrap p-1"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="24"
									height="24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M4 12.5L9.5 18L20 6" />
								</svg>
							</button>
						</div>
						<div className="flex flex-row gap-2 items-center justify-center mt-2">
							<button
								onClick={() => {
									showPresetSelector(true);
								}}
								disabled={loading}
								className="border border-white rounded px-2 whitespace-nowrap"
							>
								Load Preset
							</button>
							<button
								onClick={handlePredict}
								disabled={loading}
								className="border border-white rounded px-2"
							>
								{loading ? "Predicting..." : "Predict & Render"}
							</button>
						</div>
					</div>
				</div>
			</div>
			<div
				ref={viewerRef}
				className="fixed right-0 top-0 w-2/3 h-[calc(100vh-60px)] flex justify-center items-center"
			>
				<h1 className="text-[#3d3d3d] text-2xl">Protein Will Appear Here.</h1>
			</div>
			<div className="flex flex-row gap-2 items-center fixed bottom-0 right-0 w-2/3 h-15 border-t-2 border-r-2 border-amber-50 bg-background p-2 rounded-tr-2xl">
				<input
					id="name"
					type="text"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="protein"
					className="border border-white w-full mx-auto rounded px-2"
				/>
				<button
					className={`border ${viewer !== undefined ? "border-amber-50" : "border-amber-50/25 bg-[#3d3d3d]/25 text-font-color/25"} rounded w-min h-min whitespace-nowrap px-2`}
					onClick={downloadImg}
				>
					Download PNG
				</button>
				<button
					className={`border ${viewer !== undefined ? "border-amber-50" : "border-amber-50/25 bg-[#3d3d3d]/25 text-font-color/25"} rounded w-min h-min whitespace-nowrap px-2`}
					onClick={downloadPDB}
				>
					Download PDB
				</button>
				<a href="/credits" className="underline">
					Credits
				</a>
			</div>
			{shouldShowPresetSelector ? (
				<div className="fixed inset-0 flex items-center justify-center">
					<div className="border-2 border-amber-50 bg-background p-2 rounded-2xl max-h-2/3 overflow-scroll text-left">
						<div className="flex flex-row justify-between">
							<h1 className="text-xl font-bold">Protein Preset Selector</h1>
							<svg
								width="25"
								height="25"
								viewBox="0 0 100 100"
								xmlns="http://www.w3.org/2000/svg"
								onClick={() => showPresetSelector(false)}
							>
								<line
									x1="20"
									y1="20"
									x2="80"
									y2="80"
									stroke="white"
									strokeWidth="10"
									strokeLinecap="round"
								/>
								<line
									x1="80"
									y1="20"
									x2="20"
									y2="80"
									stroke="white"
									strokeWidth="10"
									strokeLinecap="round"
								/>
							</svg>
						</div>
						<ul>
							{proteinPresets.map((preset) => (
								<li
									key={preset.name}
									onClick={() => {
										const newPredictionInputs = [...predictionInputs];
										if (!preset.multipleSingleLetterAminoAcidChains) {
											newPredictionInputs.push({
												type: preset.type as "protein" | "dna",
												sequence: preset.singleLetterAminoAcidChain || "",
												id:
													newPredictionInputs.length === 0
														? "A"
														: getNewID(
																newPredictionInputs[newPredictionInputs.length - 1].id,
															),
												msa: {
													main_db: {
														csv: {
															alignment: `key,sequence\n-1,${preset.singleLetterAminoAcidChain}`,
															format: "csv",
														},
													},
												},
												output_format: "pdb",
											});
										} else {
											preset.singleLetterAminoAcidChains?.forEach(
												(singleLetterAminoAcidChain) => {
													newPredictionInputs.push({
														type: preset.type as "protein" | "dna",
														sequence: singleLetterAminoAcidChain || "",
														id:
															newPredictionInputs.length === 0
																? "A"
																: getNewID(
																		newPredictionInputs[newPredictionInputs.length - 1]
																			.id,
																	),
														msa: {
															main_db: {
																csv: {
																	alignment: `key,sequence\n-1,${singleLetterAminoAcidChain}`,
																	format: "csv",
																},
															},
														},
														output_format: "pdb",
													});
												},
											);
										}
										setPredictionInputs(newPredictionInputs);
										showPresetSelector(false);
										setName(preset.name);
									}}
								>
									{preset.name}
								</li>
							))}
						</ul>
					</div>
				</div>
			) : null}
		</div>
	);
}
