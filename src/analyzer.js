const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llm');
const { isIgnored } = require('./memory');

async function analyzeChanges(changedFiles, config) {
  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/analyze.txt'), 'utf8');
  const conventionsContext = JSON.stringify(config.conventions, null, 2);

  const filesContext = changedFiles.map((f) => `
### File: ${f.path}
**Has existing test:** ${f.hasTest ? `Yes → ${f.relatedTest}` : '❌ No test file found'}

\`\`\`
${f.content.slice(0, 3000)}
\`\`\`
${f.diff ? `**Diff:**\n\`\`\`diff\n${f.diff.slice(0, 1000)}\n\`\`\`` : ''}
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
  "newTestsRecommended": [
    {
      "file": "string",
      "reason": "string - why this file needs a new test",
      "priority": "low|medium|high",
      "suggestedTestCases": ["string"]
    }
  ],
  "manualQAChecklist": ["string"],
  "regressionRisks": ["string"]
}

Rules:
- "missingTests" → files that HAVE a test file but are missing specific test cases
- "newTestsRecommended" → files that have NO test file at all and should get one
- Recommend new tests for ALL untested changed files, not just risky ones
- Prioritize by complexity and risk: high = core logic/services, medium = components, low = utils/constants
`;

  const raw = await callLLM(promptTemplate, userPrompt, config, 'analysis');

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);

    parsed.newTestsRecommended = (parsed.newTestsRecommended || []).filter(
      (entry) => !isIgnored(entry.file, 'missing-test')
    );

    return parsed;
  } catch {
    return {
      riskLevel: 'unknown',
      impactedAreas: [],
      riskReasons: ['Failed to parse LLM analysis'],
      missingTests: [],
      newTestsRecommended: [],
      manualQAChecklist: [],
      regressionRisks: []
    };
  }
}

module.exports = { analyzeChanges };
