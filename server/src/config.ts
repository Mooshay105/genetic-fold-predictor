import { randomBytes } from "node:crypto";
import { accessSync, constants, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/** Settings saved in `config.json` in the data directory. */
export type SavedConfig = {
	/** Access token clients must send. */
	token: string;
};

/**
 * Picks the folder that holds jobs, results and the token.
 * @param override A folder given with `--data-dir`.
 * @returns `override`, or `$XDG_DATA_HOME/fold-server`, or `~/.local/share/fold-server`.
 */
export function dataDir(override?: string): string {
	if (override) return override;
	const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
	return join(base, "fold-server");
}

/**
 * Makes a new random access token.
 * @returns A URL-safe token.
 */
export function newToken(): string {
	return randomBytes(24).toString("base64url");
}

/**
 * Reads `config.json`, creating it with a fresh token when missing or when
 * `rotate` is set. The file is readable only by the current user.
 * @param dir The data directory.
 * @param rotate Whether to replace the token.
 * @returns The saved config.
 */
export function loadConfig(dir: string, rotate = false): SavedConfig {
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	const file = join(dir, "config.json");
	if (!rotate) {
		try {
			const saved = JSON.parse(readFileSync(file, "utf8"));
			if (typeof saved.token === "string" && saved.token.length >= 16) return saved;
		} catch {}
	}
	const config: SavedConfig = { token: newToken() };
	writeFileSync(file, JSON.stringify(config, null, "\t"), { mode: 0o600 });
	return config;
}

/**
 * Looks for an executable on `PATH`, or checks a path directly.
 * @param command A command name or path.
 * @returns True when it can be run.
 */
export function canRun(command: string): boolean {
	const candidates = command.includes("/")
		? [command]
		: (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((dir) => join(dir, command));
	return candidates.some((path) => {
		try {
			accessSync(path, constants.X_OK);
			return true;
		} catch {
			return false;
		}
	});
}
