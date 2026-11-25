import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { ThemeProvider } from "./components/theme";
import { THEME_COOKIE, parseTheme } from "@/utils/theme";
import "./styles.css";

export const metadata: Metadata = {
	title: "Genetic Fold Predictor",
	description: "Predict and view the 3D structure of proteins and DNA with OpenFold3.",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

	return (
		<html lang="en" data-theme={theme}>
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" />
				<link
					href="https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body className="text-font-color bg-background">
				<ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
				<Script src="https://3Dmol.org/build/3Dmol-min.js" strategy="beforeInteractive" />
			</body>
		</html>
	);
}
