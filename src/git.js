const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function getChangedFiles(config) {
  const { fileExtensions, ignorePaths } = config;

  let diffOutput = '';
  try {
    diffOutput = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  } catch {
    diffOutput = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
  }

  const changedPaths = diffOutput
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .filter((f) => fileExtensions.some((ext) => f.endsWith(ext)))
    .filter((f) => !ignorePaths.some((ignore) => f.includes(ignore)));

  const changedFiles = [];

  for (const filePath of changedPaths) {
    const absolutePath = path.resolve('..', filePath);
    if (!fs.existsSync(absolutePath)) continue;

    const content = fs.readFileSync(absolutePath, 'utf8');

    let diff = '';
    try {
      diff = execSync(`git diff --cached -- "${filePath}"`, { encoding: 'utf8' });
    } catch { diff = ''; }

    const relatedTest = findRelatedTest(filePath, config);

    changedFiles.push({
      path: filePath,
      content,
      diff,
      relatedTest,
      isTest: filePath.includes('.test.') || filePath.includes('.spec.')
    });
  }

  return changedFiles.filter((f) => !f.isTest);
}

function findRelatedTest(filePath, config) {
  const { testDir } = config;
  const fileName = path.basename(filePath, path.extname(filePath));
  const extensions = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx'];

  for (const ext of extensions) {
    const testPath = path.resolve('..', testDir, `${fileName}${ext}`);
    if (require('fs').existsSync(testPath)) return testPath;
  }
  return null;
}

module.exports = { getChangedFiles };
