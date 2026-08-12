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
	const viewerRef = useRef<HTMLDivElement>(null);

	async function handlePredict() {
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
				backgroundColor: "white",
			});

			viewer.addModel(pdbData, "pdb");
			viewer.setStyle({}, { cartoon: { color: "spectrum" } });
			viewer.zoomTo();
			viewer.render();
		} catch (err) {
			setError("Could not predict structure. Sequence may be too short/invalid.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const splitBaseTriplets: string[] =
			dna
				.replaceAll(" ", "")
				.toUpperCase()
				.match(/.{1,3}/g) || [];
		let protoAminoAcidChain = "";
		let protoAminoCodeChain = "";
		splitBaseTriplets.map((baseTriplet) => {
			const aminoAcid = data[baseTriplet as keyof typeof data]?.acid;
			const aminoCode = data[baseTriplet as keyof typeof data]?.code;
			if (aminoAcid !== undefined) {
				protoAminoAcidChain = protoAminoAcidChain + " " + aminoAcid;
				protoAminoCodeChain = protoAminoCodeChain + aminoCode;
			}
		});
		setAminoAcidChain(protoAminoAcidChain.trim());
		setSingleLetterAminoAcidChain(protoAminoCodeChain);
	}, [dna]);

	return (
		<div className="flex flex-col text-center justify-center">
			<div className="fixed top-0 left-0 w-1/3 h-full border-r-2 border-amber-50 p-2 flex flex-col justify-between overflow-scroll">
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
					<p className="border border-white w-full min-h-6 max-h-60 overflow-scroll mx-auto rounded px-2 text-left">
						{aminoAcidChain}
					</p>
				</div>
			</div>
			<div ref={viewerRef} className="fixed right-0 top-0 w-2/3 h-full" />
		</div>
	);
}
