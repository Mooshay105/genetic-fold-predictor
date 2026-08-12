"use client";

import { useState, useRef } from "react";
import Script from "next/script";

declare global {
	interface Window {
		$3Dmol: any;
	}
}

export default function FoldPage() {
	const [seq, setSeq] = useState("ISES");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const viewerRef = useRef<HTMLDivElement>(null);

	const handlePredict = async () => {
		setError("");
		setLoading(true);

		try {
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

	return (
		<>
			<Script src="https://3Dmol.org/build/3Dmol-min.js" strategy="beforeInteractive" />

			<main style={{ padding: 20 }}>
				<h1>Protein Folding Predictor</h1>

				<input
					value={seq}
					onChange={(e) => setSeq(e.target.value)}
					placeholder="Enter amino acid sequence"
				/>

				<button onClick={handlePredict} disabled={loading}>
					{loading ? "Predicting..." : "Predict & Render"}
				</button>

				{error && <p style={{ color: "red" }}>{error}</p>}

				<div
					ref={viewerRef}
					style={{ width: 600, height: 400, position: "relative", marginTop: 20 }}
				/>
			</main>
		</>
	);
}
