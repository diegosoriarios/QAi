const fs = require('fs');
const path = require('path');

async function buildReport({ changedFiles, analysis, qaRecommendations, testResults, config }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = config.report?.outputDir || 'reports';
  const reportDir = path.join(__dirname, '..', outputDir);
  fs.mkdirSync(reportDir, { recursive: true });

  const riskEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴', unknown: '⚪' };
  const lines = [];

  lines.push(`# QA Agent Report`);
  lines.push(`**Project:** ${config.projectName}`);
  lines.push(`**Date:** ${new Date().toLocaleString()}`);
  lines.push(
    `**Risk Level:** ${riskEmoji[analysis.riskLevel] || '⚪'} ${(analysis.riskLevel || 'unknown').toUpperCase()}`,
  );
  lines.push('');
  lines.push('## 📂 Changed Files');
  changedFiles.forEach((f) => lines.push(`- \`${f.path}\``));
  lines.push('');
  lines.push('## ⚠️ Risk Assessment');
  lines.push(`**Level:** ${(analysis.riskLevel || 'unknown').toUpperCase()}`);
  lines.push('**Reasons:**');
  (analysis.riskReasons || []).forEach((r) => lines.push(`- ${r}`));
  lines.push('');
  lines.push('## 🎯 Impacted Areas');
  (analysis.impactedAreas || []).forEach((a) => lines.push(`- ${a}`));
  lines.push('');
  lines.push('## 🧪 Missing Tests');

  if ((analysis.newTestsRecommended || []).length > 0) {
    lines.push('## 🆕 New Tests Recommended');
    lines.push('> These files have no test file at all and should get one:\n');
    (analysis.newTestsRecommended || []).forEach((r) => {
      const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[r.priority] || '⚪';
      lines.push(`### ${priorityEmoji} \`${r.file}\` [${r.priority}]`);
      lines.push(`**Why:** ${r.reason}`);
      lines.push('**Suggested test cases:**');
      (r.suggestedTestCases || []).forEach((tc) => lines.push(`- [ ] ${tc}`));
      lines.push('');
    });
  }

  (analysis.missingTests || []).forEach((m) => {
    lines.push(`### \`${m.file}\``);
    (m.testCases || []).forEach((tc) => lines.push(`- [ ] ${tc}`));
  });
  lines.push('');
  lines.push('## 🔁 Regression Risks');
  (analysis.regressionRisks || []).forEach((r) => lines.push(`- ${r}`));
  lines.push('');
  lines.push('## ✅ Manual QA Checklist');
  (analysis.manualQAChecklist || []).forEach((item) => lines.push(`- [ ] ${item}`));
  lines.push('');
  lines.push('## ▶️ Jest Test Results');
  lines.push(`- **Total:** ${testResults.total}`);
  lines.push(`- **Passed:** ✅ ${testResults.passed}`);
  lines.push(`- **Failed:** ❌ ${testResults.failed}`);
  if (testResults.failedTests.length > 0) {
    lines.push('');
    lines.push('**Failed Tests:**');
    testResults.failedTests.forEach((t) => lines.push(`- ❌ ${t}`));
  }
  lines.push('');
  lines.push('## 📌 QA Recommendations');
  if ((qaRecommendations || []).length === 0) {
    lines.push('- No additional QA recommendations.');
    lines.push('');
  } else {
    (qaRecommendations || []).forEach((r) => {
      const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[r.priority] || '🟡';
      lines.push(`### ${priorityEmoji} \`${r.file}\``);
      lines.push(`**Type:** ${r.type}`);
      lines.push(`**Why:** ${r.why}`);
      lines.push('**What should change:**');
      lines.push('- Add or improve tests based on the suggested test cases below.');
      lines.push('**What tests should exist:**');
      (r.suggestedTestCases || []).forEach((tc) => lines.push(`- [ ] ${tc}`));
      lines.push('');
    });
  }

  const reportContent = lines.join('\n');
  const reportPath = path.join(reportDir, `qa-report-${timestamp}.md`);
  fs.writeFileSync(reportPath, reportContent, 'utf8');

  const summary = [
    `Risk: ${riskEmoji[analysis.riskLevel]} ${(analysis.riskLevel || 'unknown').toUpperCase()}`,
    `Tests: ✅ ${testResults.passed} passed | ❌ ${testResults.failed} failed`,
    `Missing test cases: ${(analysis.missingTests || []).reduce((acc, m) => acc + m.testCases.length, 0)}`,
    `QA recommendations: ${(qaRecommendations || []).length}`,
  ].join('\n');

  return { summary, path: reportPath, content: reportContent };
}

module.exports = { buildReport };
