const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', '.scan-history.json');
const MAX_ENTRIES = 50;

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift({
    id: Date.now(),
    subnet: entry.subnet,
    netmask: entry.netmask,
    hostsFound: entry.hostsFound,
    totalPorts: entry.totalPorts,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    durationMs: entry.durationMs,
  });

  const trimmed = history.slice(0, MAX_ENTRIES);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed[0];
}

function clearHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    fs.unlinkSync(HISTORY_FILE);
  }
}

module.exports = { loadHistory, saveHistory, clearHistory };
