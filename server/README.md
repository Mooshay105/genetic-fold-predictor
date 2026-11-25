# fold-server

A small self-hosted queue that runs [Boltz-2](https://github.com/jwohlwend/boltz)
on your own computer for [Genetic Fold Predictor](https://genetic-fold-predictor.malcolmjh.com).

When a prediction is too big for NVIDIA's hosted API (more than 12 chains, a
chain over 4096 residues, or a job that will not finish in time), the site sends
it to your fold-server instead. Jobs wait in a queue and run one at a time. On
the site, **My server** lists your jobs, and you can edit any job until it has
been predicted. Editing a running job restarts it with the new chains.

## Install

You need [Bun](https://bun.sh) and Boltz:

```sh
pip install boltz            # needs Python 3.10+; a CUDA GPU is strongly recommended
```

Then build the CLI from this folder and put it on your `PATH`:

```sh
cd server
bun run build                # writes dist/fold-server, a single executable
install -m 755 dist/fold-server ~/.local/bin/
```

## Run

```sh
fold-server start            # add --cpu if the machine has no GPU (much slower)
```

It prints a link like `http://127.0.0.1:8765/?token=...`. On the site, open
**My server**, paste the link and press **Connect**. The link holds the access
token, so treat it like a password. `fold-server token --rotate` makes a new one
and invalidates old links.

### Using it from another device

The site is served over https, so browsers only allow plain `http://` for
`localhost`. To use a fold-server on another machine (or from your phone), put it
behind an https tunnel and tell fold-server the public URL so the printed link
uses it:

```sh
tailscale funnel 8765        # or: cloudflared tunnel --url http://localhost:8765
fold-server start --public-url https://my-machine.my-tailnet.ts.net
```

Keep the default `--host 127.0.0.1`. The tunnel connects to localhost.

## Commands and options

| Command                     | What it does                               |
| --------------------------- | ------------------------------------------ |
| `fold-server start`         | Start the server and print the link        |
| `fold-server link`          | Print the link again                       |
| `fold-server jobs`          | List jobs and their status in the terminal |
| `fold-server token --rotate`| Make a new access token                    |

| Option             | Default                       | Meaning                                                   |
| ------------------ | ----------------------------- | --------------------------------------------------------- |
| `--port`           | `8765`                        | Port to listen on                                         |
| `--host`           | `127.0.0.1`                   | Address to listen on                                      |
| `--public-url`     |                               | https URL a tunnel gives the server, used in the link     |
| `--origin`         |                               | Extra site origin allowed by CORS (repeatable)            |
| `--data-dir`       | `~/.local/share/fold-server`  | Where jobs, results and the token are kept                |
| `--boltz`          | `boltz`                       | The Boltz command                                         |
| `--cpu`            | off                           | Run Boltz on the CPU                                      |
| `--msa-server`     | off                           | Build MSAs with the public ColabFold server. More accurate, but it sends your sequences to a third party |

Without `--msa-server`, protein chains are folded in single-sequence mode,
which matches what the site sends to NVIDIA.

Stopping the server with Ctrl+C puts a running job back in the queue, and jobs
survive restarts.

## HTTP API

Every `/api` request needs `Authorization: Bearer <token>`.

| Method   | Path                        | Does                                                |
| -------- | --------------------------- | --------------------------------------------------- |
| `GET`    | `/api/info`                 | Version and queue size                              |
| `GET`    | `/api/jobs`                 | All jobs, newest first                              |
| `POST`   | `/api/jobs`                 | Queue `{ name, chains: [{ id, type, sequence }] }`  |
| `GET`    | `/api/jobs/:id`             | One job                                             |
| `PATCH`  | `/api/jobs/:id`             | Edit `{ name?, chains? }`; `409` once it is done    |
| `DELETE` | `/api/jobs/:id`             | Delete, stopping it if it is running                |
| `GET`    | `/api/jobs/:id/structure`   | `{ text, format: "cif" }` for a finished job        |

## Development

The code lives in `server/src` and shares its request types and validation with
the site through `utils/fold-server-api.ts`. Its tests run with the rest of the
project (`bun run test` at the repo root) and use a fake runner, so they never
start Boltz.
