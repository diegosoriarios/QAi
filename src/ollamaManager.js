const { spawn, spawnSync } = require('child_process');
const http = require('http');
const readline = require('readline');

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function selectLLMStrategy(config) {
  const interactive = config.ollama?.interactiveSetup !== false;
  const qualityModel = config.llm?.model || 'qwen2.5-coder:7b';
  const fastModel = config.llm?.fastModel || qualityModel;
  const current = config.llm?.strategy || 'quality';

  if (!interactive) {
    config.llm = { ...(config.llm || {}), strategy: current };
    return current;
  }

  console.log('\n🧠 Choose LLM strategy:');
  console.log(`   1) quality (${qualityModel})`);
  console.log(`   2) balanced (analysis: ${fastModel}, others: ${qualityModel})`);
  console.log(`   3) fast (${fastModel})`);

  const answer = (await askQuestion(`Select strategy [1/2/3 or quality/balanced/fast] (default: ${current}): `)).toLowerCase();

  let selected = current;
  if (answer === '1' || answer === 'quality') selected = 'quality';
  if (answer === '2' || answer === 'balanced') selected = 'balanced';
  if (answer === '3' || answer === 'fast') selected = 'fast';

  config.llm = { ...(config.llm || {}), strategy: selected };
  console.log(`✅ Strategy selected: ${selected}`);
  return selected;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return { ok: result.status === 0, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function isOllamaInstalled() {
  return runCommand('ollama', ['--version']).ok;
}

async function isOllamaServerRunning() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: 11434, path: '/api/tags', method: 'GET', timeout: 1000 },
      (res) => resolve(res.statusCode === 200)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function startOllamaServer() {
  try {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    child.unref();
    for (let i = 0; i < 10; i++) {
      if (await isOllamaServerRunning()) return true;
      await sleep(1000);
    }
    return false;
  } catch {
    return false;
  }
}

function listLocalModels() {
  const result = runCommand('ollama', ['list']);
  if (!result.ok) return [];
  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);
}

function hasModel(modelName) {
  return listLocalModels().includes(modelName);
}

async function pullModel(modelName) {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', modelName], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`Failed to pull model: ${modelName}`));
    });
    child.on('error', reject);
  });
}

function stopModel(modelName) {
  return runCommand('ollama', ['stop', modelName]).ok;
}

function openOllamaDownloadPage() {
  const url = 'https://ollama.com/download';
  if (process.platform === 'darwin') { runCommand('open', [url]); return; }
  if (process.platform === 'win32') { runCommand('cmd', ['/c', 'start', '', url]); return; }
  runCommand('xdg-open', [url]);
}

function getRequiredModelsForStrategy(config) {
  const strategy = config.llm?.strategy || 'quality';
  const qualityModel = config.llm?.model || 'qwen2.5-coder:7b';
  const fastModel = config.llm?.fastModel || qualityModel;

  if (strategy === 'fast') {
    return [fastModel];
  }

  if (strategy === 'balanced') {
    return [...new Set([fastModel, qualityModel])];
  }

  return [qualityModel];
}

async function ensureStrategyModelsReady(config) {
  const interactive = config.ollama?.interactiveSetup !== false;
  const autoPullModel = config.ollama?.autoPullModel !== false;
  const requiredModels = getRequiredModelsForStrategy(config);

  for (const modelName of requiredModels) {
    if (hasModel(modelName)) {
      continue;
    }

    console.log(`\n⚠️ Model not found locally: ${modelName}`);
    if (!interactive || !autoPullModel) {
      throw new Error(`Model ${modelName} is missing. Run: ollama pull ${modelName}`);
    }

    const shouldPull = await askYesNo(`Pull ${modelName} now?`);
    if (!shouldPull) {
      throw new Error(`Model ${modelName} is required. Run: ollama pull ${modelName}`);
    }

    await pullModel(modelName);
  }
}

async function ensureOllamaReady(config) {
  const modelName = config.llm?.model || 'qwen2.5-coder:7b';
  const interactive = config.ollama?.interactiveSetup !== false;
  const autoPullModel = config.ollama?.autoPullModel !== false;
  const autoStartServer = config.ollama?.autoStartServer !== false;

  if (!isOllamaInstalled()) {
    console.log('\n❌ Ollama is not installed.');
    if (interactive) {
      const shouldOpen = await askYesNo('Open the Ollama download page now?');
      if (shouldOpen) openOllamaDownloadPage();
    }
    throw new Error('Ollama is required. Install it from https://ollama.com/download and rerun the QA agent.');
  }

  const serverRunning = await isOllamaServerRunning();
  if (!serverRunning) {
    console.log('\n⚠️ Ollama server is not running.');
    let started = false;
    if (autoStartServer) {
      console.log('Trying to start Ollama...');
      started = await startOllamaServer();
    }
    if (!started && !(await isOllamaServerRunning())) {
      throw new Error('Ollama is installed but not running. Start Ollama and rerun the QA agent.');
    }
  }

  if (!hasModel(modelName)) {
    console.log(`\n⚠️ Model not found locally: ${modelName}`);
    if (!interactive || !autoPullModel) {
      throw new Error(`Model ${modelName} is missing. Run: ollama pull ${modelName}`);
    }
    const shouldPull = await askYesNo(`Pull ${modelName} now? (~4.7GB)`);
    if (!shouldPull) {
      throw new Error(`Model ${modelName} is required. Run: ollama pull ${modelName}`);
    }
    await pullModel(modelName);
  }

  console.log(`\n✅ Ollama ready. Using model: ${modelName}`);
}

module.exports = { ensureOllamaReady, stopModel, selectLLMStrategy, ensureStrategyModelsReady };
