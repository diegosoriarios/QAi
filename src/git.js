const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');

function git(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT });
}

function getCurrentBranch() {
  return git('git rev-parse --abbrev-ref HEAD').trim();
}

function getChangedFilePaths(config) {
  const mode = config.git?.mode || 'staged';
  const compareBranch = config.git?.compareBranch || 'main';

  let diffOutput = '';

  if (mode === 'branch') {
    // Compare current branch with another branch
    const current = getCurrentBranch();
    console.log(`🔀 Comparing branch "${current}" → "${compareBranch}"`);
    diffOutput = git(`git diff ${compareBranch}...HEAD --name-only`);
  } else if (mode === 'staged') {
    // Only staged files (default, good for pre-commit)
    diffOutput = git('git diff --cached --name-only');
  } else if (mode === 'unstaged') {
    // All modified files, staged or not
    diffOutput = git('git diff HEAD --name-only');
  }

  return diffOutput
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .filter((f) => config.fileExtensions.some((ext) => f.endsWith(ext)))
    .filter((f) => !config.ignorePaths.some((ignore) => f.includes(ignore)));
}

function getDiff(filePath, config) {
  const mode = config.git?.mode || 'staged';
  const compareBranch = config.git?.compareBranch || 'main';

  try {
    if (mode === 'branch') {
      return git(`git diff ${compareBranch}...HEAD -- "${filePath}"`);
    } else if (mode === 'staged') {
      return git(`git diff --cached -- "${filePath}"`);
    } else {
      return git(`git diff HEAD -- "${filePath}"`);
    }
  } catch {
    return '';
  }
}

function findRelatedTest(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));
  const extensions = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx', '.spec.ts', '.spec.tsx'];

  for (const ext of extensions) {
    const testPath = path.resolve(REPO_ROOT, dir, `${fileName}${ext}`);
    if (fs.existsSync(testPath)) return testPath;
  }
  return null;
}

async function getChangedFiles(config) {
  const changedPaths = getChangedFilePaths(config);
  const changedFiles = [];

  for (const filePath of changedPaths) {
    const absolutePath = path.resolve(REPO_ROOT, filePath);
    if (!fs.existsSync(absolutePath)) continue;

    const content = fs.readFileSync(absolutePath, 'utf8');
    const diff = getDiff(filePath, config);
    const relatedTest = findRelatedTest(filePath, config);

    changedFiles.push({
      path: filePath,
      content,
      diff,
      relatedTest,
      hasTest: relatedTest !== null,
      isTest: filePath.includes('.test.') || filePath.includes('.spec.'),
    });
  }
  return changedFiles; //.filter((f) => !f.isTest);
}

module.exports = { getChangedFiles };
