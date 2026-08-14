"use client";

import { useEffect, useRef, useState } from "react";
import codonTable from "../public/codon-table.json";
import proteinPresets from "../public/protein-presets.json";
import Script from "next/script";
import { getProteinPDBData } from "@/utils/actions";

export default function Home() {
	const [dna, setDNA] = useState("");
	const [aminoAcidChain, setAminoAcidChain] = useState("");
	const [singleLetterAminoAcidChain, setSingleLetterAminoAcidChain] = useState("");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [pdb, setPDB] = useState<string | null>(null);
	const [viewer, setViewer] = useState<Mol3DViewer>();
	const [name, setName] = useState<string>("protein");
	const [shouldShowPresetSelector, showPresetSelector] = useState(false);
	const viewerRef = useRef<HTMLDivElement>(null);
	const skipCodeNextRef = useRef(false);
	const skipDNANextRef = useRef(false);

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
		if (singleLetterAminoAcidChain === "" && dna === "") {
			setError("Please Provide A DNA Sequence.");
			return;
		}
		setError("");
		setLoading(true);

		try {
			const pdbData = await getProteinPDBData(singleLetterAminoAcidChain);

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
				"Oops! The service could not predict the proteins structure! It might be too short/invalid. Or there is just a one off error, so please try again.",
			);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (skipDNANextRef.current === true) {
			skipDNANextRef.current = false;
			return;
		}
		const splitBaseTriplets: string[] =
			dna
				.replaceAll(" ", "")
				.toUpperCase()
				.match(/.{1,3}/g) || [];
		let protoAminoAcidChain = "";
		let protoAminoCodeChain = "";
		splitBaseTriplets.forEach((baseTriplet) => {
			const aminoAcid = codonTable.dna[baseTriplet as keyof typeof codonTable.dna]?.acid;
			const aminoCode = codonTable.dna[baseTriplet as keyof typeof codonTable.dna]?.code;
			if (aminoAcid !== undefined) {
				protoAminoAcidChain = protoAminoAcidChain + " " + aminoAcid;
				protoAminoCodeChain = protoAminoCodeChain + aminoCode;
			}
		});
		skipCodeNextRef.current = true;
		setAminoAcidChain(protoAminoAcidChain.trim());
		setSingleLetterAminoAcidChain(protoAminoCodeChain);
	}, [dna]);

	useEffect(() => {
		if (skipCodeNextRef.current === true) {
			skipCodeNextRef.current = false;
			return;
		}
		skipDNANextRef.current = true;
		setDNA("");
		const splitAcids: string[] =
			singleLetterAminoAcidChain
				.replaceAll(" ", "")
				.toUpperCase()
				.match(/.{1,1}/g) || [];
		let protoAminoAcidChain = "";
		splitAcids.forEach((acid) => {
			const aminoAcid = codonTable.code[acid as keyof typeof codonTable.code]?.acid;
			if (aminoAcid !== undefined) {
				protoAminoAcidChain = protoAminoAcidChain + " " + aminoAcid;
			}
		});
		setAminoAcidChain(protoAminoAcidChain.trim());
	}, [singleLetterAminoAcidChain]);

	return (
		<div className="flex flex-col text-center justify-center">
			<div className="fixed top-0 left-0 w-1/3 h-full border-r-2 border-t-2 border-amber-50 bg-[#121212] p-2 flex flex-col justify-between overflow-scroll rounded-tr-2xl">
				<div>
					<Script
						src="https://3Dmol.org/build/3Dmol-min.js"
						strategy="beforeInteractive"
					/>
					<h1 className="text-2xl font-bold">DNA Sequence (Max 1200 base pairs):</h1>
					<input
						id="dnaSequence"
						type="text"
						value={dna}
						onChange={(event) => setDNA(event.target.value)}
						placeholder="ATC TCC GAG TCG TAG"
						maxLength={1600}
						className="border border-white w-full mx-auto rounded px-2"
					/>
					<h1 className="text-2xl font-bold">
						Single Letter Amino Acid Code (Max 400 amino acids):
					</h1>
					<div className="flex flex-row gap-2">
						<input
							id="singleLetterAminoAcidChain"
							type="text"
							value={singleLetterAminoAcidChain.trim()}
							onChange={(event) => setSingleLetterAminoAcidChain(event.target.value)}
							placeholder="ISES"
							maxLength={400}
							className="border border-white w-full mx-auto rounded px-2"
						/>
						<button
							onClick={() => {
								showPresetSelector(true);
							}}
							disabled={loading}
							className="border border-white mx-auto rounded px-2 whitespace-nowrap"
						>
							Load Protein
						</button>
					</div>
					<button
						onClick={handlePredict}
						disabled={loading}
						className="border border-white mx-auto rounded px-2 mt-4"
					>
						{loading ? "Predicting..." : "Predict & Render"}
					</button>
					{error && <p style={{ color: "red" }}>{error}</p>}
				</div>
				<div className="">
					<h2 className="text-2xl font-bold">Amino Acid Code:</h2>
					<p className="border border-white w-full min-h-6 max-h-60 overflow-scroll mb-2 mx-auto rounded px-2 text-left">
						{aminoAcidChain}
					</p>
				</div>
			</div>
			<div
				ref={viewerRef}
				className="fixed right-0 top-0 w-2/3 h-[calc(100vh-60px)] flex justify-center items-center"
			>
				<h1 className="text-[#3d3d3d] text-2xl">Protein Will Appear Here.</h1>
			</div>
			<div className="flex flex-row gap-2 items-center fixed bottom-0 right-0 w-2/3 h-15 border-t-2 border-r-2 border-amber-50 bg-[#121212] p-2 rounded-tr-2xl">
				<input
					id="name"
					type="text"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="protein"
					maxLength={400}
					className="border border-white w-full mx-auto rounded px-2"
				/>
				<button
					className={`border ${viewer !== undefined ? "border-amber-50 bg-[#3d3d3d]" : "border-amber-50/25 bg-[#3d3d3d]/25 text-[#ededed]/25"} rounded w-min h-min whitespace-nowrap px-2`}
					onClick={downloadImg}
				>
					Download PNG
				</button>
				<button
					className={`border ${viewer !== undefined ? "border-amber-50 bg-[#3d3d3d]" : "border-amber-50/25 bg-[#3d3d3d]/25 text-[#ededed]/25"} rounded w-min h-min whitespace-nowrap px-2`}
					onClick={downloadPDB}
				>
					Download PDB
				</button>
			</div>
			{shouldShowPresetSelector ? (
				<div className="fixed inset-0 flex items-center justify-center">
					<div className="border-2 border-amber-50 bg-[#121212] p-2 rounded-2xl max-h-2/3 overflow-scroll text-left">
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
									key={preset.singleLetterAminoAcidChain}
									onClick={() => {
										setSingleLetterAminoAcidChain(preset.singleLetterAminoAcidChain);
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
