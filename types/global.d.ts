declare global {
	interface Window {
		$3Dmol?: {
			createViewer(element: HTMLElement, config: object): Mol3DViewer;
		};
	}
}

export {};
