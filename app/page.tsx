"use client";

import { useEffect, useRef, useState } from "react";
import data from "../public/data.json";
import Script from "next/script";

export default function Home() {
	const [dna, setDNA] = useState("");
	const [aminoAcidChain, setAminoAcidChain] = useState("");
	const [singleLetterAminoAcidChain, setSingleLetterAminoAcidChain] = useState("");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [pdb, setPDB] = useState<string | null>(null);
	const [viewer, setViewer] = useState<Mol3DViewer>();
	const [name, setName] = useState<string>("protein");
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
			const response = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: singleLetterAminoAcidChain.trim(),
			});

			if (!response.ok) {
				console.log(response);
				throw new Error("Prediction failed");
			}

			const pdbData = await response.text();

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
			const aminoAcid = data.dna[baseTriplet as keyof typeof data.dna]?.acid;
			const aminoCode = data.dna[baseTriplet as keyof typeof data.dna]?.code;
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
			const aminoAcid = data.code[acid as keyof typeof data.code]?.acid;
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
						onClick={handlePredict}
						disabled={loading}
						className="border border-white mx-auto rounded px-2 mt-2"
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
		</div>
	);
}
