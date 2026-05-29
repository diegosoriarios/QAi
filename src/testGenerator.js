async function generateTests(changedFiles, analysis) {
  const qaRecommendations = [];

  for (const file of changedFiles) {
    const recommended = analysis.newTestsRecommended?.find((r) => r.file === file.path);
    if (!recommended) continue;
    if (file.hasTest) continue;

    qaRecommendations.push({
      type: 'new-test-needed',
      file: file.path,
      priority: recommended.priority || 'medium',
      why: recommended.reason,
      suggestedTestCases: recommended.suggestedTestCases || []
    });
  }

  for (const file of changedFiles) {
    const missingForFile = analysis.missingTests?.find((m) => m.file === file.path);
    if (!missingForFile) continue;

    qaRecommendations.push({
      type: 'improve-existing-tests',
      file: file.path,
      priority: 'medium',
      why: 'Existing test file is missing important test coverage for recent changes.',
      suggestedTestCases: missingForFile.testCases || []
    });
  }

  return qaRecommendations;
}

module.exports = { generateTests };
