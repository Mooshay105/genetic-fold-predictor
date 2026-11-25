/** How the structure is drawn. */
export type Representation = "cartoon" | "stick" | "sphere" | "line";

/** How the structure is coloured. */
export type ColorScheme = "spectrum" | "chain" | "secondary" | "element";

/** Display settings for the 3D viewer. */
export type ViewerStyle = {
	/** Drawing style. */
	representation: Representation;
	/** Colouring. */
	color: ColorScheme;
	/** Whether the model spins around the Y axis. */
	spin: boolean;
};

/** The look a fresh viewer starts with. */
export const DEFAULT_VIEWER_STYLE: ViewerStyle = {
	representation: "cartoon",
	color: "spectrum",
	spin: false,
};

/** Menu labels for each representation. */
export const REPRESENTATION_LABELS: Record<Representation, string> = {
	cartoon: "Cartoon",
	stick: "Sticks",
	sphere: "Spacefill",
	line: "Wireframe",
};

/** Menu labels for each colour scheme. */
export const COLOR_LABELS: Record<ColorScheme, string> = {
	spectrum: "Rainbow",
	chain: "By chain",
	secondary: "Secondary",
	element: "By element",
};

const COLOR_OPTIONS: Record<ColorScheme, object> = {
	spectrum: { color: "spectrum" },
	chain: { colorscheme: "chain" },
	secondary: { colorscheme: "ssJmol" },
	element: { colorscheme: "default" },
};

/**
 * Builds the 3Dmol.js style object for a representation and colour scheme.
 * @param style The display settings.
 * @returns The object to pass to `viewer.setStyle({}, ...)`.
 */
export function toMol3DStyle(style: ViewerStyle): object {
	return { [style.representation]: { ...COLOR_OPTIONS[style.color] } };
}
