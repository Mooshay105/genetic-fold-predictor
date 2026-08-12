"use client";

import { useEffect, useRef, useState } from "react";
import data from "../public/data.json";
import Script from "next/script";

export default function Home() {
	const [dna, setDNA] = useState("");
	const [aminoAcidChain, setAminoAcidChain] = useState("");

	const [seq, setSeq] = useState("ISES");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const viewerRef = useRef<HTMLDivElement>(null);

	const handlePredict = async () => {
		setError("");
		setLoading(true);

		try {
			console.log(seq.trim());
			const response = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: seq.trim(),
			});

			if (!response.ok) throw new Error("Prediction failed");

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
	};

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
		setAminoAcidChain(protoAminoAcidChain);
		setSeq(protoAminoCodeChain);
	}, [dna]);

	return (
		<div className="flex flex-col text-center justify-center">
			<Script src="https://3Dmol.org/build/3Dmol-min.js" strategy="beforeInteractive" />
			<h1 className="text-3xl font-bold">Enter The DNA Sequence:</h1>
			<input
				id="dnaSequence"
				type="text"
				value={dna}
				onChange={(event) => setDNA(event.target.value)}
				placeholder="ATC TCC TAG"
				className="border border-white w-200 mx-auto rounded px-2"
			/>
			<h1 className="text-3xl font-bold">Amino Acid Chain:</h1>
			<p className="border border-white w-200 mx-auto rounded px-2">{aminoAcidChain}</p>
			<button
				onClick={handlePredict}
				disabled={loading}
				className="border border-white mx-auto rounded px-2 mt-2"
			>
				{loading ? "Predicting..." : "Predict & Render"}
			</button>

			{error && <p style={{ color: "red" }}>{error}</p>}

			<div
				ref={viewerRef}
				style={{ width: 600, height: 400, position: "relative", marginTop: 20 }}
				className="w-150 h-100 relative mt-5 rounded-2xl mx-auto"
			/>
		</div>
	);
}
