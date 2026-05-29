const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llm');

async function analyzeChanges(changedFiles, config) {
  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/analyze.txt'), 'utf8');
  const conventionsContext = JSON.stringify(config.conventions, null, 2);

  const filesContext = changedFiles.map((f) => `
### File: ${f.path}
\`\`\`
${f.content.slice(0, 3000)}
\`\`\`
${f.diff ? `**Diff:**\n\`\`\`diff\n${f.diff.slice(0, 1000)}\n\`\`\`` : ''}
${f.relatedTest ? `**Existing test file found:** ${f.relatedTest}` : '**No existing test file found**'}
`).join('\n---\n');

  const userPrompt = `
## Project Conventions
${conventionsContext}

## Changed Files
${filesContext}

Respond ONLY in valid JSON matching this structure:
{
  "riskLevel": "low|medium|high|critical",
  "impactedAreas": ["string"],
  "riskReasons": ["string"],
  "missingTests": [
    { "file": "string", "testCases": ["string"] }
  ],
  "manualQAChecklist": ["string"],
  "regressionRisks": ["string"]
}
`;

  const raw = await callLLM(promptTemplate, userPrompt, config);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      riskLevel: 'unknown',
      impactedAreas: [],
      riskReasons: ['Failed to parse LLM analysis'],
      missingTests: [],
      manualQAChecklist: [],
      regressionRisks: []
    };
  }
}

module.exports = { analyzeChanges };
