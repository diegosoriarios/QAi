const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llm');

async function generateTests(changedFiles, analysis, config) {
  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/generate.txt'), 'utf8');
  const generatedTests = [];

  // --- Existing: generate missing test cases for files that already have tests ---
  for (const file of changedFiles) {
    const missingForFile = analysis.missingTests?.find((m) => m.file === file.path);
    if (!missingForFile) continue;

    const testCode = await generateTestCode(file, missingForFile.testCases, promptTemplate, config);
    const saved = saveGeneratedTest(file.path, testCode, config, false);

    generatedTests.push({
      sourceFile: file.path,
      testFile: saved.outputPath,
      isNewFile: false,
      testCases: missingForFile.testCases,
      code: testCode
    });
  }

  // --- New: generate brand new test files for untested changed files ---
  for (const file of changedFiles) {
    const recommended = analysis.newTestsRecommended?.find((r) => r.file === file.path);
    if (!recommended) continue;
    if (file.hasTest) continue; // already has a test, handled above

    console.log(`   🆕 Generating new test file for: ${file.path} [priority: ${recommended.priority}]`);

    const testCode = await generateTestCode(file, recommended.suggestedTestCases, promptTemplate, config);
    const saved = saveGeneratedTest(file.path, testCode, config, true);

    generatedTests.push({
      sourceFile: file.path,
      testFile: saved.outputPath,
      isNewFile: true,
      priority: recommended.priority,
      reason: recommended.reason,
      testCases: recommended.suggestedTestCases,
      code: testCode
    });
  }

  return generatedTests;
}

async function generateTestCode(file, testCases, promptTemplate, config) {
  let exampleTest = '';
  const examplePath = file.path.toLowerCase().includes('component') || file.path.toLowerCase().includes('screen')
    ? config.conventions?.componentTestExample
    : config.conventions?.serviceTestExample;

  if (examplePath) {
    const absExample = path.resolve('..', examplePath);
    if (fs.existsSync(absExample)) {
      exampleTest = fs.readFileSync(absExample, 'utf8').slice(0, 1500);
    }
  }

  const userPrompt = `
## Source File: ${file.path}
\`\`\`
${file.content.slice(0, 3000)}
\`\`\`

## Test Cases to Generate
${testCases.map((tc, i) => `${i + 1}. ${tc}`).join('\n')}

## Example Test (follow this style exactly)
\`\`\`
${exampleTest || 'No example available - use standard Jest + React Native Testing Library style'}
\`\`\`

## Project Conventions
${JSON.stringify(config.conventions || {}, null, 2)}

Generate ONLY the test file code. No explanation. No markdown fences.
`;

  return await callLLM(promptTemplate, userPrompt, config);
}

function saveGeneratedTest(filePath, testCode, config, isNewFile) {
  let outputPath;

  if (isNewFile) {
    // Save next to the source file
    const dir = path.resolve('..', path.dirname(filePath));
    const fileName = path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath);
    outputPath = path.join(dir, `${fileName}.test${ext}`);
  } else {
    // Save in reports/generated-tests for review
    const fileName = path.basename(filePath, path.extname(filePath)) + '.test' + path.extname(filePath);
    outputPath = path.join(__dirname, '../reports/generated-tests', fileName);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, testCode, 'utf8');
  return { outputPath };
}

module.exports = { generateTests };
