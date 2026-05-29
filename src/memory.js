const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', '.qa-agent-memory.json');

function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) {
    return { ignored: [] };
  }

  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ignored)) {
      return { ignored: [] };
    }
    return parsed;
  } catch {
    return { ignored: [] };
  }
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
}

function isIgnored(file, reason) {
  const memory = loadMemory();
  return (memory.ignored || []).some((entry) => entry.file === file && entry.reason === reason);
}

module.exports = { loadMemory, saveMemory, isIgnored };
