# Genetic Fold Predictor

Next.js 16 (App Router) + React 19 + Tailwind 4 site that sends protein/DNA
sequences to NVIDIA's hosted Boltz-2 (default, returns mmCIF) or OpenFold3
(returns PDB) API (`utils/actions.ts`, a server action, polling NVCF while a
job is queued; `app/page.tsx` sets `maxDuration = 300` for it) and renders the
result with 3Dmol.js in the browser. The UI has two themes, Modern and
Windows 98, chosen by the `theme` cookie; both views share
`app/components/use-predictor.ts`.

## Full send

Use bun only (npm is blocked). The bun version is pinned in `package.json`
(`packageManager`) and in `.github/workflows/ci.yml`; keep them in sync.

| Step      | Command                          |
| --------- | -------------------------------- |
| Install   | `bun install --frozen-lockfile`  |
| Typecheck | `bun run typecheck` (runs `next typegen` then `tsc --noEmit`) |
| Lint      | `bun run lint`                   |
| Test      | `bun run test` (`bun test`)      |
| Build     | `bun run build`                  |
| Dev       | `bun run dev`                    |

CI (`.github/workflows/ci.yml`, single job `ci`) runs install, typecheck,
lint, test and build on every pull request and on push to `main`. The `ci`
check is required by the `main` ruleset, branches must be up to date before
merging, and PRs are squash-merged.

Tests live next to the code as `*.test.ts` and use `bun:test`. They are
excluded from `tsconfig.json` because the project has no `@types/bun`; do not
add it without asking. Tests must never call the real NVIDIA API: stub
`globalThis.fetch` as `utils/actions.test.ts` does.

### Viewing the app

`bun run dev` serves the app at http://localhost:3000 (the credits page is
at `/credits`). There is no login and no database or seed data. The page loads
and the preset picker works without any secrets, but pressing Predict calls
the NVIDIA API and needs `NVIDIA_API_KEY` in `.env.local`. Without a key the
request fails and the page shows its "Oops!" error message, which is expected.

### What merging does

Merging to `main` triggers a Vercel **production** deploy to
https://genetic-fold-predictor.malcolmjh.com through the Vercel GitHub
integration (there is no deploy workflow or `vercel.json` in the repo).

The owner (Mooshay105) has approved this for full send: agents may merge their
own PRs to `main` once the merge gate passes (proof covers the diff, `ci` is
green, the branch is up to date and review findings are handled), and the
resulting production deploy is acceptable.

### Never touch

- `.env.local` or any other `.env*` file, and the `NVIDIA_API_KEY` value. Never
  print, commit, log or send it anywhere.
- The Vercel project, its settings, domains and environment variables.
- The `main` ruleset, branch protection and repo merge settings.
- Real NVIDIA API calls in tests or CI (they cost credits and need the key).
- `LICENCE.md` (GPL 3.0).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
