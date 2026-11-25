"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { THEME_COOKIE, Theme } from "@/utils/theme";

type ThemeContextValue = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
	theme: "modern",
	setTheme: () => {},
});

export function ThemeProvider({
	initialTheme,
	children,
}: {
	initialTheme: Theme;
	children: React.ReactNode;
}) {
	const [theme, setThemeState] = useState<Theme>(initialTheme);

	const setTheme = useCallback((next: Theme) => {
		document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		document.documentElement.dataset.theme = next;
		setThemeState(next);
	}, []);

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	return useContext(ThemeContext);
}
