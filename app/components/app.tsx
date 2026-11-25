"use client";

import { ModernView } from "./modern-view";
import { useTheme } from "./theme";
import { usePredictor } from "./use-predictor";
import { Win98View } from "./win98-view";

export function App() {
	const { theme } = useTheme();
	const predictor = usePredictor();

	return theme === "win98" ? <Win98View p={predictor} /> : <ModernView p={predictor} />;
}
