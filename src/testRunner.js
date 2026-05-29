const { execSync } = require('child_process');
const path = require('path');

async function runTests(config) {
  const { command, args, timeout, rootDir } = config.jest;
  const fullCommand = `${command} ${args.join(' ')}`;
  const cwd = path.resolve(__dirname, '..', rootDir || '..');

  let output = '';
  let success = false;

  try {
    output = execSync(fullCommand, { cwd, encoding: 'utf8', timeout: timeout || 60000, stdio: ['pipe', 'pipe', 'pipe'] });
    success = true;
  } catch (err) {
    output = (err.stdout || '') + (err.stderr || '');
    success = false;
  }

  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const totalMatch = output.match(/(\d+) total/);

  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

  const failedTests = [];
  const failedMatches = output.matchAll(/● (.+)/g);
  for (const match of failedMatches) failedTests.push(match[1].trim());

  return { success, passed, failed, total, failedTests, output };
}

module.exports = { runTests };
