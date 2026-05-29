const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llm');

const CACHE_FILE = path.join(__dirname, '../.conventions-cache.json');
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isCacheValid() {
  if (!fs.existsSync(CACHE_FILE)) return false;
  const { timestamp } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  return Date.now() - timestamp < CACHE_MAX_AGE_MS;
}

function loadCache() {
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')).conventions;
}

function saveCache(conventions) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), conventions }, null, 2));
}

/**
 * Recursively collect files up to a max count
 */
function collectFiles(dir, extensions, ignorePaths, maxFiles = 30) {
  const results = [];

  function walk(current) {
    if (results.length >= maxFiles) return;
    if (!fs.existsSync(current)) return;

    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(dir, fullPath);

      if (ignorePaths.some((ig) => relative.includes(ig))) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Build a folder tree string (2 levels deep)
 */
function buildFolderTree(dir, ignorePaths, depth = 0, maxDepth = 3) {
  if (depth > maxDepth || !fs.existsSync(dir)) return '';

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const lines = [];

  for (const entry of entries) {
    if (ignorePaths.some((ig) => entry.name.includes(ig))) continue;
    const indent = '  '.repeat(depth);
    if (entry.isDirectory()) {
      lines.push(`${indent}📁 ${entry.name}/`);
      lines.push(buildFolderTree(path.join(dir, entry.name), ignorePaths, depth + 1, maxDepth));
    } else {
      lines.push(`${indent}📄 ${entry.name}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Pick a representative sample of files
 * Tries to get: components, screens, hooks, services, tests
 */
function pickSampleFiles(allFiles, testFiles) {
  const pick = (keyword, max) =>
    allFiles.filter((f) => f.toLowerCase().includes(keyword)).slice(0, max);

  const samples = [
    ...pick('component', 2),
    ...pick('screen', 2),
    ...pick('hook', 2),
    ...pick('service', 2),
    ...pick('store', 1),
    ...pick('util', 1),
    ...testFiles.slice(0, 4)
  ];

  // Deduplicate
  return [...new Set(samples)].slice(0, 12);
}

function readFileSample(filePath, maxChars = 1500) {
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, maxChars);
  } catch {
    return '';
  }
}

async function scanConventions(config, force = false) {
  if (!force && isCacheValid()) {
    console.log('📋 Using cached project conventions (run with --scan-conventions to refresh)');
    return loadCache();
  }

  console.log('🔎 Scanning project conventions...');

  const srcDir = path.resolve(__dirname, '..', config.srcDir);
  const testDir = path.resolve(__dirname, '..', config.testDir);
  const { fileExtensions, ignorePaths } = config;

  // Collect source and test files
  const sourceFiles = collectFiles(srcDir, fileExtensions, ignorePaths, 40);
  const testFiles = collectFiles(testDir, fileExtensions, ignorePaths, 20);

  // Build folder tree
  const folderTree = buildFolderTree(srcDir, ignorePaths);
  const testFolderTree = buildFolderTree(testDir, ignorePaths);

  // Pick representative samples
  const sampleFiles = pickSampleFiles(sourceFiles, testFiles);

  // Build file samples context
  const fileSamples = sampleFiles.map((f) => {
    const relative = path.relative(path.resolve(__dirname, '../..'), f);
    return `### ${relative}\n\`\`\`\n${readFileSample(f)}\n\`\`\``;
  }).join('\n\n---\n\n');

  const systemPrompt = `You are a senior React Native engineer analyzing a project codebase.
Your job is to infer the project's conventions from its folder structure and code samples.
Always respond in valid JSON only. No explanation outside the JSON.`;

  const userPrompt = `
## Source Folder Structure
\`\`\`
${folderTree}
\`\`\`

## Test Folder Structure
\`\`\`
${testFolderTree}
\`\`\`

## Code Samples
${fileSamples}

Based on the above, infer the project conventions and respond ONLY in this JSON structure:
{
  "folderStructure": {
    "components": "string - where components live",
    "screens": "string - where screens live",
    "hooks": "string - where hooks live",
    "services": "string - where services/API calls live",
    "store": "string - state management location and library",
    "tests": "string - where tests live and how they are organized"
  },
  "namingConventions": {
    "components": "string - e.g. PascalCase",
    "files": "string - e.g. camelCase.tsx",
    "testFiles": "string - e.g. ComponentName.test.tsx",
    "hooks": "string - e.g. useHookName",
    "services": "string - e.g. AuthService.ts"
  },
  "testingPatterns": {
    "framework": "string - e.g. Jest + React Native Testing Library",
    "describeStyle": "string - example describe block pattern",
    "itStyle": "string - example it/test block pattern",
    "mockStyle": "string - how mocks are set up",
    "renderStyle": "string - how components are rendered in tests",
    "assertionStyle": "string - preferred assertion style"
  },
  "stateManagement": "string - e.g. Redux Toolkit, Zustand, Context API",
  "navigationLibrary": "string - e.g. React Navigation v6",
  "importStyle": "string - e.g. absolute imports with @/ alias",
  "typescriptUsage": "string - strict, loose, or none",
  "summary": "string - 2-3 sentence summary of the project conventions"
}
`;

  const raw = await callLLM(systemPrompt, userPrompt, config);

  let conventions;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    conventions = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn('⚠️ Could not parse conventions scan. Using config fallback.');
    conventions = config.conventions || {};
  }

  saveCache(conventions);
  console.log('✅ Conventions scanned and cached.\n');
  console.log(`   ${conventions.summary || ''}\n`);

  return conventions;
}

module.exports = { scanConventions };
