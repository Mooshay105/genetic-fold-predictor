interface Mol3DViewer {
	pngURI(): string;
	addModel(data: string, format: string): void;
	setStyle(sel: object, style: object): void;
	zoomTo(): void;
	render(): void;
}
