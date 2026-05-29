const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llm');

async function generateTests(changedFiles, analysis, config) {
  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/generate.txt'), 'utf8');
  const generatedTests = [];

  for (const file of changedFiles) {
    const missingForFile = analysis.missingTests?.find((m) => m.file === file.path);
    if (!missingForFile) continue;

    let exampleTest = '';
    const examplePath = file.path.includes('component') || file.path.includes('screen')
      ? config.conventions.componentTestExample
      : config.conventions.serviceTestExample;

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
${missingForFile.testCases.map((tc, i) => `${i + 1}. ${tc}`).join('\n')}

## Example Test (follow this style exactly)
\`\`\`
${exampleTest || 'No example available - use standard Jest + React Native Testing Library style'}
\`\`\`

## Project Conventions
${JSON.stringify(config.conventions, null, 2)}

Generate ONLY the test file code. No explanation. No markdown fences.
`;

    const testCode = await callLLM(promptTemplate, userPrompt, config);
    const outputFileName = path.basename(file.path, path.extname(file.path)) + '.test' + path.extname(file.path);
    const outputPath = path.join(__dirname, '../reports/generated-tests', outputFileName);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, testCode, 'utf8');

    generatedTests.push({
      sourceFile: file.path,
      testFile: outputPath,
      testCases: missingForFile.testCases,
      code: testCode
    });
  }

  return generatedTests;
}

module.exports = { generateTests };
