"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Job, ServerConnection, ServerInfo, parseServerLink } from "@/utils/fold-server-api";
import { getServerInfo, listJobs } from "@/utils/fold-server-client";

const STORAGE_KEY = "fold-server";
const POLL_MS = 15_000;

const listeners = new Set<() => void>();
let fallback: ServerConnection | null = null;
let cache: { raw: string | null; value: ServerConnection | null } = { raw: null, value: null };

function readConnection(): ServerConnection | null {
	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return fallback;
	}
	if (raw !== cache.raw) {
		let value: ServerConnection | null = null;
		try {
			const saved = JSON.parse(raw ?? "null");
			if (saved && typeof saved.url === "string" && typeof saved.token === "string") value = saved;
		} catch {}
		cache = { raw, value };
	}
	return cache.value;
}

function writeConnection(connection: ServerConnection | null) {
	fallback = connection;
	try {
		if (connection) localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY) listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : "Could not reach your fold server.";
}

export function useFoldServer() {
	const connection = useSyncExternalStore(subscribe, readConnection, () => null);
	const [info, setInfo] = useState<ServerInfo | null>(null);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [status, setStatus] = useState("");
	const [checking, setChecking] = useState(false);

	const refresh = useCallback(async () => {
		const current = readConnection();
		if (!current) return;
		try {
			const [nextInfo, nextJobs] = await Promise.all([getServerInfo(current), listJobs(current)]);
			if (readConnection() !== current) return;
			setInfo(nextInfo);
			setJobs(nextJobs);
			setStatus("");
		} catch (error) {
			if (readConnection() !== current) return;
			setInfo(null);
			setStatus(describeError(error));
		}
	}, []);

	useEffect(() => {
		if (!connection) return;
		const first = setTimeout(refresh, 0);
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, POLL_MS);
		return () => {
			clearTimeout(first);
			clearInterval(timer);
		};
	}, [connection, refresh]);

	const connect = useCallback(async (link: string) => {
		const parsed = parseServerLink(link);
		if (!parsed.ok) {
			setStatus(parsed.message);
			return false;
		}
		setChecking(true);
		setStatus("");
		try {
			const [nextInfo, nextJobs] = await Promise.all([
				getServerInfo(parsed.connection),
				listJobs(parsed.connection),
			]);
			setInfo(nextInfo);
			setJobs(nextJobs);
			writeConnection(parsed.connection);
			return true;
		} catch (error) {
			setStatus(describeError(error));
			return false;
		} finally {
			setChecking(false);
		}
	}, []);

	const disconnect = useCallback(() => {
		writeConnection(null);
		setInfo(null);
		setJobs([]);
		setStatus("");
	}, []);

	return { connection, info, jobs, status, checking, connect, disconnect, refresh };
}

/** Everything the views get from {@link useFoldServer}. */
export type FoldServer = ReturnType<typeof useFoldServer>;
