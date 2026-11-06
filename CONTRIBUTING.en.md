# Contributing
[简体中文](CONTRIBUTING.md) | [繁體中文](CONTRIBUTING.zh-TW.md) | **English**

Reproducible problems, documentation fixes, plugins, and improvements to shared capabilities are welcome, in Chinese or in English.

## Where to talk

- [Issues](https://github.com/Jimmy-Prime/agent-autoloop/issues/new/choose): failures you can reproduce, and feature ideas with a clear scenario. What can be done, a maintainer fixes. The fix commit credits the reporter.
- [Questions](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/q-a): installing, rules, and agent and channel configuration.
- [Ideas](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/ideas): discuss ideas that are not a development task yet.
- [Show and tell](https://github.com/Jimmy-Prime/agent-autoloop/discussions/categories/show-and-tell): share plugins, recipes, and how you use it.
- For a security issue, contact a maintainer as described in the [security notes](SECURITY.en.md). Do not disclose exploit details in a public discussion.

## What to contribute

New agents, event plugins, and channels connect at the plugin layer. A complete business flow can be a recipe. Read the [plugin guide](docs/plugins.en.md) and the [existing recipes](README.en.md#ready-to-use-recipes) first, so the same thing is not built twice.

The kernel keeps zero runtime dependencies and does not connect to external products. Overview pages, workflow canvases, and other interfaces belong to separate clients. They do not go in this repository. Before changing the protocol or a core flow, describe the concrete scenario and the compatibility impact. Maintenance conventions are in [AGENTS.md](AGENTS.md). The protocol is in [docs/protocol.en.md](docs/protocol.en.md).

## Submitting a change

1. Create a branch from the latest `main`. Outside contributors use a fork. Branches in this repository may only start with `claude/`, `codex/`, or `dependabot/`. Tags are only for releases (`v1.2.3`). Agents develop in a separate worktree. The main directory stays on `main`.
2. Use Node.js 24 or newer, and run `npm ci`. One PR solves one problem, and it updates the affected Chinese and English docs, examples, and configuration together.
3. To fix a bug, first write a failing test that reproduces it. The top of the test file says which failure it prevents. For a docs-only change, a template, or a small reversible change, do not add a test that copies the implementation.
4. Before you submit, run `npm run test:quick`, `npm run typecheck`, and `npm run format:check`. When you changed `kernel/`, `protocol/`, or `sim/`, use `npm test`. That also runs the full simulation and the enumeration. When logs, the deadline table, or concurrency are involved, also run `npm run test:nightly`. CI checks on Linux and macOS, and it runs an install-to-uninstall smoke test with the committed code. A docs-only change skips these checks. On a PR, a short simulation of 20,000 steps runs only when `kernel/`, `protocol/`, or the simulation itself changed. After the merge, the quick tests and the install smoke test run once more. The full simulation, the enumeration, the crash test, and mutation run once a day on a schedule, and the quick tests also run on the latest Node.
5. Open a PR against `main`. Describe the problem, the behavior after the change, what you verified, and the compatibility impact. Unfinished work is a draft. Before merge, confirm that both system checks on the current commit pass. Please check “Allow edits by maintainers”. When something needs adjusting, a maintainer usually edits your branch directly and then merges. A fork's CI runs on GitHub's machines, automatically. The first PR from a newly registered GitHub account runs only after a maintainer approves it.

Tests use a temporary `AGENT_AUTOLOOP_HOME`, a random port, local fake HTTP, and a fake notification command. Do not connect to a real business database, send messages, or open another event listener on a Feishu app that is already online. The real delivery script creates and deletes a named test repository. Run it only when the user explicitly asks.

Do not commit keys, card links that grant permission, a full configuration, a database, run output, or a colleague's data. Redact logs and screenshots in an issue first. Code is submitted under the [MIT License](LICENSE).

What users install is the latest Release, not `main`. A change merged into `main` reaches users at the next Release. How to install and update is in [INSTALL.en.md](INSTALL.en.md). The version-number rules are in the [protocol](docs/protocol.en.md#versions-and-compatibility). There is no long-term support branch at present. Auto-merge in the repository settings stays off. The delivery plugin finishes review, checks, and the merge as described in the [delivery protocol](docs/protocol.en.md#delivery-plugin).
