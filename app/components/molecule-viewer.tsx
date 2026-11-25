"use client";

import { useEffect, useRef } from "react";
import { Structure } from "@/utils/actions";
import { ViewerStyle, toMol3DStyle } from "@/utils/viewer-style";

type MoleculeViewerProps = {
	/** Structure file to show. */
	structure: Structure;
	/** Canvas background colour. */
	background: string;
	/** Display settings. */
	viewerStyle: ViewerStyle;
	/** Receives the viewer once it exists and `undefined` when it goes away. */
	onViewer: (viewer: Mol3DViewer | undefined) => void;
	className?: string;
};

function waitFor3Dmol(signal: AbortSignal) {
	return new Promise<NonNullable<Window["$3Dmol"]>>((resolve) => {
		const check = () => {
			if (signal.aborted) return;
			if (window.$3Dmol) resolve(window.$3Dmol);
			else setTimeout(check, 100);
		};
		check();
	});
}

export function MoleculeViewer({
	structure,
	background,
	viewerStyle,
	onViewer,
	className,
}: MoleculeViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewerRef = useRef<Mol3DViewer>(undefined);
	const styleRef = useRef(viewerStyle);
	const onViewerRef = useRef(onViewer);

	useEffect(() => {
		styleRef.current = viewerStyle;
		onViewerRef.current = onViewer;
	});

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const controller = new AbortController();
		let observer: ResizeObserver | undefined;

		waitFor3Dmol(controller.signal).then(($3Dmol) => {
			if (controller.signal.aborted) return;
			const viewer = $3Dmol.createViewer(container, { backgroundColor: background });
			viewer.addModel(structure.text, structure.format);
			viewer.setStyle({}, toMol3DStyle(styleRef.current));
			viewer.zoomTo();
			viewer.spin(styleRef.current.spin ? "y" : false);
			viewer.render();
			viewerRef.current = viewer;
			onViewerRef.current(viewer);
			observer = new ResizeObserver(() => viewer.resize());
			observer.observe(container);
		});

		return () => {
			controller.abort();
			observer?.disconnect();
			viewerRef.current?.spin(false);
			viewerRef.current?.clear();
			viewerRef.current = undefined;
			container.innerHTML = "";
			onViewerRef.current(undefined);
		};
	}, [structure, background]);

	useEffect(() => {
		const viewer = viewerRef.current;
		if (!viewer) return;
		viewer.setStyle({}, toMol3DStyle(viewerStyle));
		viewer.spin(viewerStyle.spin ? "y" : false);
		viewer.render();
	}, [viewerStyle]);

	return <div ref={containerRef} className={className ?? "relative"} />;
}
