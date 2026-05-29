# QA Agent — Documentation

### What is this?

A **fully local, zero-cost QA agent** that runs before every commit in your React Native project. It uses a small LLM running on your own machine (via Ollama) to analyze code changes, flag risks, recommend tests, and generate test skeletons — without sending your code to any external service.

### 1. Why is this a good option to use in projects?

**It fits naturally into your existing workflow.**  
The agent runs as a pre-commit hook — you don't change how you work. You write code, you commit, the agent runs silently in the background and stops you only when something is actually risky.

**It's proactive, not reactive.**  
Most QA happens after a bug reaches staging or production. This agent catches missing tests, risky changes, and regression risks *before the code even leaves your machine*.

**It's fully local and private.**  
Your source code never leaves your machine. No API calls to OpenAI, no code uploaded to a cloud service, no tokens consumed per commit. This matters especially in projects with NDAs, proprietary logic, or sensitive business rules.

**It scales with your team without extra cost.**  
Each developer runs their own instance. There's no shared API quota, no per-seat pricing, no rate limits. A team of 10 costs the same as a team of 1 — zero.

**It's lightweight and non-blocking.**  
Using `qwen2.5-coder:7b`, the agent runs in seconds on most modern laptops. It uses ~5GB of RAM during the run and releases it immediately after. It doesn't require Docker, a server, or any cloud infrastructure.

**It teaches good habits passively.**  
Developers get immediate feedback on what tests are missing and why. Over time, the team naturally writes better-tested code because the agent makes the gap visible on every commit.

### 2. Why is this better than using an AI agent in Claude Code or OpenCode?

| | **This QA Agent** | **Claude Code / OpenCode Agent** |
|---|---|---|
| **Cost** | Free forever | Pay per token, per commit, per developer |
| **Privacy** | 100% local, code never leaves machine | Code sent to Anthropic/OpenAI servers |
| **Speed** | Runs in seconds | Depends on API latency + rate limits |
| **Offline** | Works with no internet | Requires internet connection |
| **Control** | You own the prompts, logic, and output | Black box — you trust the vendor |
| **Customization** | Fully customizable per project | Limited to what the tool exposes |
| **CI integration** | Optional, runs pre-commit | Usually tied to their own CI/CD |
| **Team scaling** | No extra cost per developer | Cost multiplies with team size |
| **Model updates** | You choose when to upgrade | Vendor controls model changes |
| **Vendor lock-in** | None — swap Ollama model anytime | Locked to Claude/OpenAI ecosystem |

**The key difference in philosophy:**

Claude Code and OpenCode agents are **general-purpose coding assistants** — they can do anything but are optimized for nothing specific. This agent is **purpose-built for one job**: QA before commit, in a React Native project, following *your* conventions. That specificity makes it faster, cheaper, and more accurate for this exact use case.

Claude Code also operates **interactively** — a developer has to ask it to review code. This agent is **automatic** — it runs whether the developer remembers to ask or not.

### 3. Pros and Cons

#### ✅ Pros

- **Zero ongoing cost** — no API keys, no subscriptions, no per-token billing
- **Complete privacy** — code stays on your machine, always
- **Works offline** — no internet required after initial model download
- **Convention-aware** — learns your project's actual patterns, not generic best practices
- **Non-intrusive** — only blocks commits on critical risk + failing tests
- **Generates real test skeletons** — not just suggestions, actual runnable code
- **Finds untested files** — flags files with no test at all, not just missing cases
- **Branch comparison mode** — works even when nothing is staged
- **Model flexibility** — swap `qwen2.5-coder:7b` for any Ollama model anytime
- **Fully open** — every prompt, every decision, every output is visible and editable

#### ❌ Cons

- **Requires Ollama installed** — small one-time setup per machine (~5 min)
- **First model pull is large** — `qwen2.5-coder:7b` is ~4.7GB download
- **LLM output is non-deterministic** — generated tests need human review before merging
- **Not a replacement for a real QA engineer** — it catches obvious gaps, not subtle logic errors
- **RAM usage during run** — ~5GB while active (released immediately after)
- **Limited historical memory** — it only stores ignored recommendation entries, not long-term learning from past reports
- **Prompt quality matters** — if your prompts are vague, output quality drops
- **React Native focused** — works best for RN + Jest projects out of the box, needs adaptation for other stacks

#### ⚖️ When NOT to use this

- If your laptop has less than 8GB RAM total
- If your project has zero tests and no intention of adding them
- If your team needs audit trails and compliance logging (the reports help, but it's not enterprise-grade)

### Bottom line

> This agent is the right tool when you want **automated QA guardrails that are free, private, and always running** — without depending on a vendor, an internet connection, or a shared budget. It won't replace your QA team, but it will make sure no developer accidentally ships untested, risky code without at least being warned first.

### 4. How it works (runtime flow)

On each run, the agent executes a fixed pipeline:

1. Ensures Ollama is installed/running, then selects an LLM strategy and confirms required models are available.
2. Optionally rescans project conventions when `--scan-conventions` is passed.
3. Detects changed files from git, filters by configured extensions/ignored paths, and loads file content + diffs.
4. Runs LLM analysis to classify risk, impacted areas, regression risks, and test gaps.
5. Converts analysis into actionable QA recommendations.
6. Runs Jest using your configured command/args/rootDir.
7. Writes a markdown report and prints a short console summary.
8. Blocks commit only in the strict case: critical risk + failing tests.
9. Unloads the quality model from RAM after the run when auto-stop is enabled.

### 5. Configuration highlights

The agent behavior is driven by `qa-agent.config.json`.

- **Project scope**: `srcDir`, `testDir`, `fileExtensions`, `ignorePaths`
- **LLM**: `llm.provider`, `llm.model`, `llm.fastModel`, `llm.strategy`
- **Git diff mode**: `git.mode`, `git.compareBranch`
- **Jest execution**: `jest.command`, `jest.args`, `jest.rootDir`, `jest.timeout`
- **Ollama runtime**: `ollama.interactiveSetup`, `ollama.autoPullModel`, `ollama.autoStartServer`, `ollama.autoStopModel`, `ollama.keepAlive`, `ollama.numCtx`
- **Reports**: `report.outputDir`

### 6. LLM strategies

The project supports three modes:

- **quality**: uses `llm.model` for everything
- **balanced**: uses `llm.fastModel` for analysis and `llm.model` for heavier steps
- **fast**: uses `llm.fastModel` for everything

If interactive setup is enabled, strategy is chosen via prompt at runtime. The selected strategy determines which models must exist locally and will be auto-pulled only when allowed by config.

### 7. Git modes

- **staged**: analyzes `git diff --cached` (best for pre-commit)
- **unstaged**: analyzes `git diff HEAD` (all local modifications)
- **branch**: compares current branch against `git.compareBranch` using `branch...HEAD`

This lets the same agent work for local commits and branch-level validation in CI-like flows.

### 8. Convention scanning and cache

The agent learns project conventions by scanning folder structure + representative code samples, then asks the LLM to infer:

- folder layout conventions
- naming conventions
- testing patterns
- state/navigation/import style
- TypeScript usage

Results are cached in `.conventions-cache.json` for 7 days. Use `node index.js --scan-conventions` to force refresh.

### 9. Memory behavior (ignored recommendations)

Ignored items are persisted in `.qa-agent-memory.json` so repeated runs do not keep surfacing the same “new test needed” entries.

- memory is loaded before filtering recommendations
- newly ignored `missing-test` entries are saved after the run
- reset behavior by removing `.qa-agent-memory.json`

### 10. Commit policy

The commit is blocked only when both are true:

- analysis risk level is `critical`
- Jest has one or more failing tests

Everything else is reported as warnings/recommendations with a successful exit.

### 11. Report contents

Each run produces `qa-report-<timestamp>.md` under `report.outputDir` (default: `reports`).

Reports include:

- changed files
- risk level and reasons
- impacted areas
- missing tests in existing suites
- files that need brand new tests
- regression risks
- manual QA checklist
- Jest pass/fail summary + failed test names
- prioritized QA recommendations

### 12. Operational notes and troubleshooting

- **Ollama missing**: install from `https://ollama.com/download`
- **Ollama not running**: enable auto-start or start `ollama serve` manually
- **Model missing**: pull manually (`ollama pull <model>`) or allow auto-pull
- **Slow runs**: use `balanced`/`fast`, reduce scope, or tune model/context settings
- **Recommendations feel stale**: force convention rescan with `--scan-conventions`
- **Need a clean recommendation state**: remove `.qa-agent-memory.json`
