/** The visual themes the app can render in. */
export type Theme = "modern" | "win98";

/** Name of the cookie that stores the chosen theme. */
export const THEME_COOKIE = "theme";

/** Background colour of the 3D viewer in each theme. */
export const VIEWER_BACKGROUND: Record<Theme, string> = {
	modern: "#121212",
	win98: "#000000",
};

/**
 * Narrows an unknown cookie value to a theme.
 * @param value The raw cookie value, if any.
 * @returns The theme it names, or `modern` for anything else.
 */
export function parseTheme(value: string | undefined): Theme {
	return value === "win98" ? "win98" : "modern";
}
