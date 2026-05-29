# QA Agent — React Native

Local QA agent that runs before every commit. Analyzes changed files, flags risks,
generates Jest test skeletons, runs your test suite, and produces a markdown report.
Uses Ollama + qwen2.5-coder:7b — fully local, no tokens, no cloud.

## Folder structure
```
qa-agent/
├── index.js
├── qa-agent.config.json
├── src/
│   ├── git.js
│   ├── llm.js
│   ├── ollamaManager.js
│   ├── analyzer.js
│   ├── testGenerator.js
│   ├── testRunner.js
│   └── reporter.js
├── prompts/
│   ├── analyze.txt
│   └── generate.txt
├── reports/              ← generated at runtime
└── .husky/
    └── pre-commit
```

## Setup

### 1. Install Ollama
Download from https://ollama.com/download
The agent will prompt you automatically if it's missing.

### 2. Configure the agent
Edit qa-agent.config.json:
- Set srcDir and testDir to match your project
- Point componentTestExample and serviceTestExample to real test files

### 3. Set up the pre-commit hook
From your project root:
  npx husky install
  cp qa-agent/.husky/pre-commit .husky/pre-commit
  chmod +x .husky/pre-commit

### 4. Run manually
  cd qa-agent
  node index.js

## First run behaviour
- If Ollama is not installed → prompts to open download page
- If Ollama is not running → tries to start it automatically
- If qwen2.5-coder:7b is missing → prompts to pull it (~4.7GB)
- After the agent finishes → model is unloaded from RAM automatically

## Output
- Console summary with risk level and test results
- Full markdown report → qa-agent/reports/
- Generated test skeletons → qa-agent/reports/generated-tests/

## Config options (ollama block)

## Run
```
node index.js --mode=branch --compare=main
```
