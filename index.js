#!/usr/bin/env node

const { getChangedFiles } = require('./src/git');
const { analyzeChanges } = require('./src/analyzer');
const { generateTests } = require('./src/testGenerator');
const { scanConventions } = require('./src/conventionScanner')
const { runTests } = require('./src/testRunner');
const { buildReport } = require('./src/reporter');
const { ensureOllamaReady, stopModel } = require('./src/ollamaManager');
const config = require('./qa-agent.config.json');

async function run() {
  let analysis = null;
  let testResults = null;

  try {
    if (config.llm?.provider === 'ollama') {
      await ensureOllamaReady(config);
      const forceRescan = process.argv.includes('--scan-conventions')
      const conventions = await scanConventions(config, forceRescan)
      config.conventions = conventions;
    }

    console.log('\n🤖 QA Agent starting...\n');

    const changedFiles = await getChangedFiles(config);
    if (changedFiles.length === 0) {
      console.log('✅ No relevant files changed. Skipping QA Agent.');
      return;
    }

    console.log(`📂 Changed files detected: ${changedFiles.length}`);
    changedFiles.forEach((f) => console.log(`   - ${f.path}`));

    console.log('\n🔍 Analyzing changes...');
    analysis = await analyzeChanges(changedFiles, config);

    console.log('\n🧪 Generating test suggestions...');
    const generatedTests = await generateTests(changedFiles, analysis, config);

    console.log('\n▶️ Running Jest tests...');
    testResults = await runTests(config);

    console.log('\n📝 Building QA report...');
    const report = await buildReport({
      changedFiles,
      analysis,
      generatedTests,
      testResults,
      config
    });

    console.log('\n' + '='.repeat(60));
    console.log(report.summary);
    console.log('='.repeat(60));
    console.log(`\n📄 Full report saved to: ${report.path}\n`);

    if (analysis.riskLevel === 'critical' && testResults.failed > 0) {
      console.log('🚨 Commit blocked: Critical risk + failing tests. Fix issues before committing.\n');
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  } catch (err) {
    console.error('\nQA Agent error:', err.message);
    process.exitCode = 1;
  } finally {
    if (config.llm?.provider === 'ollama' && config.ollama?.autoStopModel !== false) {
      const modelName = config.llm?.model || 'qwen2.5-coder:7b';
      const stopped = stopModel(modelName);
      if (stopped) {
        console.log(`🛑 Unloaded model: ${modelName}`);
      }
    }
  }
}

run();
