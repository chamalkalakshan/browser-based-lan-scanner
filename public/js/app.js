/* ===== State ===== */
const state = {
  ws: null,
  connected: false,
  scanning: false,
  hosts: [],
  startTime: null,
  elapsedTimer: null,
  totalProbed: 0,
  currentView: 'table',
  selectedHost: null,
};

/* ===== DOM refs ===== */
const el = {
  connectionBadge: document.getElementById('connection-status'),
  historyBtn: document.getElementById('history-btn'),
  historyModal: document.getElementById('history-modal'),
  historyBody: document.getElementById('history-body'),
  historyCloseBtn: document.getElementById('history-close-btn'),
  historyClearBtn: document.getElementById('history-clear-btn'),
  interfaceSelect: document.getElementById('interface-select'),
  subnetInput: document.getElementById('subnet-input'),
  netmaskInput: document.getElementById('netmask-input'),
  portScanToggle: document.getElementById('port-scan-toggle'),
  scanBtn: document.getElementById('scan-btn'),
  stopBtn: document.getElementById('stop-btn'),
  scanSpeed: document.getElementById('scan-speed'),
  exportJsonBtn: document.getElementById('export-json-btn'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  viewTableBtn: document.getElementById('view-table-btn'),
  viewGridBtn: document.getElementById('view-grid-btn'),
  networkInfoList: document.getElementById('network-info-list'),
  statTotal: document.getElementById('stat-total'),
  statFound: document.getElementById('stat-found'),
  statPorts: document.getElementById('stat-ports'),
  statElapsed: document.getElementById('stat-elapsed'),
  statusText: document.getElementById('scan-status-text'),
  progressContainer: document.getElementById('progress-container'),
  progressBar: document.getElementById('progress-bar'),
  progressLabel: document.getElementById('progress-label'),
  logContainer: document.getElementById('log-container'),
  resultsContainer: document.getElementById('results-container'),
  resultsTbody: document.getElementById('results-tbody'),
  resultsGrid: document.getElementById('results-grid'),
  detailPanel: document.getElementById('detail-panel'),
  detailTitle: document.getElementById('detail-title'),
  detailBody: document.getElementById('detail-body'),
  detailCloseBtn: document.getElementById('detail-close-btn'),
};

/* ===== WebSocket ===== */
function connectWS() {
  const wsUrl = `ws://${window.location.host}`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.connected = true;
    updateConnectionBadge(true);
    log('Connected to scanner server', 'success');
  };

  state.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  state.ws.onclose = () => {
    state.connected = false;
    updateConnectionBadge(false);
    log('Disconnected from server. Reconnecting...', 'warning');
    setTimeout(connectWS, 3000);
  };

  state.ws.onerror = () => {
    log('WebSocket error occurred', 'error');
  };
}

function sendMessage(type, data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type, data }));
  }
}

/* ===== Message handler ===== */
function handleMessage(msg) {
  const { type, data } = msg;

  switch (type) {
    case 'connected':
      loadNetworkInfo();
      break;

    case 'scan-start':
      onScanStart();
      log(data.message, 'info');
      break;

    case 'scan-info':
      log(data.message, 'info');
      if (data.total) state.totalProbed = data.total;
      el.statTotal.textContent = data.total || state.totalProbed;
      break;

    case 'scan-error':
      log(data.message, 'error');
      onScanEnd();
      break;

    case 'discovery-progress':
      updateProgress(data.percent, data.completed, data.total);
      if (data.current && data.current.alive) {
        log(`Found: ${data.current.ip}`, 'discovery');
      }
      break;

    case 'discovery-complete':
      log(data.message, 'success');
      el.statFound.textContent = data.count;
      break;

    case 'enriching-host':
      el.statusText.textContent = `Enriching ${data.ip}...`;
      break;

    case 'port-scan-start':
      log(`Port scanning ${data.ip}...`, 'info');
      break;

    case 'host-result':
      addHostToResults(data);
      break;

    case 'scan-aborted':
      log(data.message || 'Scan aborted', 'warning');
      onScanEnd();
      break;

    case 'scan-complete':
      log(data.message, 'success');
      onScanEnd();
      if (data.hosts) {
        state.hosts = data.hosts;
        updateStats();
      }
      break;

    default:
      break;
  }
}

/* ===== Scan lifecycle ===== */
function onScanStart() {
  state.scanning = true;
  state.hosts = [];
  state.startTime = Date.now();
  el.scanBtn.disabled = true;
  el.stopBtn.disabled = false;
  el.exportJsonBtn.disabled = true;
  el.exportCsvBtn.disabled = true;
  el.progressContainer.hidden = false;
  el.resultsContainer.hidden = false;
  el.resultsTbody.innerHTML = '';
  el.resultsGrid.innerHTML = '';
  resetStats();
  startElapsedTimer();
  el.statusText.textContent = 'Scanning...';

  const placeholder = el.logContainer.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();
}

function onScanEnd() {
  state.scanning = false;
  el.scanBtn.disabled = false;
  el.stopBtn.disabled = true;
  el.exportJsonBtn.disabled = state.hosts.length === 0;
  el.exportCsvBtn.disabled = state.hosts.length === 0;
  stopElapsedTimer();
  el.statusText.textContent = `Scan complete - ${state.hosts.length} host(s) found`;
  updateProgress(100);
}

function resetStats() {
  el.statTotal.textContent = '0';
  el.statFound.textContent = '0';
  el.statPorts.textContent = '0';
  el.statElapsed.textContent = '0s';
}

function updateStats() {
  const totalPorts = state.hosts.reduce((sum, h) => sum + (h.openPorts?.length || 0), 0);
  el.statFound.textContent = state.hosts.length;
  el.statPorts.textContent = totalPorts;
}

function startElapsedTimer() {
  stopElapsedTimer();
  state.elapsedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    el.statElapsed.textContent = elapsed >= 60
      ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
      : `${elapsed}s`;
  }, 1000);
}

function stopElapsedTimer() {
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

/* ===== Progress ===== */
function updateProgress(percent, completed, total) {
  const p = Math.min(100, Math.max(0, percent));
  el.progressBar.style.width = p + '%';
  el.progressLabel.textContent = p + '%';
  if (completed !== undefined && total !== undefined) {
    el.statTotal.textContent = total;
    el.statusText.textContent = `Probing ${completed} / ${total}`;
  }
}

/* ===== Logging ===== */
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  entry.innerHTML = `<span class="log-time">[${time}]</span>${escapeHtml(message)}`;
  el.logContainer.appendChild(entry);
  el.logContainer.scrollTop = el.logContainer.scrollHeight;
}

/* ===== Connection badge ===== */
function updateConnectionBadge(connected) {
  el.connectionBadge.textContent = connected ? 'Connected' : 'Disconnected';
  el.connectionBadge.className = connected ? 'badge badge-connected' : 'badge badge-disconnected';
}

/* ===== Network Info ===== */
async function loadNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    const { interfaces } = await res.json();

    el.networkInfoList.innerHTML = '';
    el.interfaceSelect.innerHTML = '<option value="">Auto-detect</option>';

    if (!interfaces.length) {
      el.networkInfoList.innerHTML = '<p class="text-muted">No interfaces found</p>';
      return;
    }

    for (const iface of interfaces) {
      const item = document.createElement('div');
      item.className = 'info-item';
      item.innerHTML = `
        <div class="info-item-name">${escapeHtml(iface.name)}</div>
        <div class="info-item-ip">${escapeHtml(iface.address)}</div>
        <div class="info-item-meta">${escapeHtml(iface.cidr || '')} | Gateway: ${escapeHtml(iface.subnet)}</div>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.info-item').forEach((i) => i.classList.remove('selected'));
        item.classList.add('selected');
        el.subnetInput.value = iface.subnet;
        el.netmaskInput.value = iface.netmask;
      });
      el.networkInfoList.appendChild(item);

      const option = document.createElement('option');
      option.value = iface.name;
      option.textContent = `${iface.name} (${iface.address})`;
      el.interfaceSelect.appendChild(option);
    }
  } catch (err) {
    el.networkInfoList.innerHTML = '<p class="text-muted">Failed to load interfaces</p>';
  }
}

/* ===== Scan control ===== */
el.scanBtn.addEventListener('click', () => {
  if (!state.connected) {
    log('Not connected to server', 'error');
    return;
  }
  const subnet = el.subnetInput.value.trim() || null;
  const netmask = el.netmaskInput.value.trim() || '255.255.255.0';
  const scanPorts = el.portScanToggle.checked;
  const speed = el.scanSpeed ? el.scanSpeed.value : 'normal';
  const timeoutMs = speed === 'fast' ? 500 : speed === 'thorough' ? 2000 : 1000;
  sendMessage('start-scan', { subnet, netmask, scanPorts, timeoutMs });
});

el.stopBtn.addEventListener('click', () => {
  sendMessage('abort-scan', {});
  onScanEnd();
  log('Scan aborted by user', 'warning');
});

/* ===== View toggle ===== */
el.viewTableBtn.addEventListener('click', () => {
  state.currentView = 'table';
  el.viewTableBtn.classList.add('active');
  el.viewGridBtn.classList.remove('active');
  document.getElementById('results-table').hidden = false;
  el.resultsGrid.hidden = true;
});

el.viewGridBtn.addEventListener('click', () => {
  state.currentView = 'grid';
  el.viewGridBtn.classList.add('active');
  el.viewTableBtn.classList.remove('active');
  document.getElementById('results-table').hidden = true;
  el.resultsGrid.hidden = false;
});

/* ===== Add host to results ===== */
function addHostToResults(host) {
  state.hosts.push(host);
  addToTable(host);
  addToGrid(host);
  el.statFound.textContent = state.hosts.length;
  const totalPorts = state.hosts.reduce((sum, h) => sum + (h.openPorts?.length || 0), 0);
  el.statPorts.textContent = totalPorts;
}

function addToTable(host) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="ip-cell">${escapeHtml(host.ip)}</td>
    <td class="hostname-cell">${escapeHtml(host.hostname || 'Unknown')}</td>
    <td class="mac-cell">${escapeHtml(host.mac || 'N/A')}</td>
    <td>${deviceBadgeHtml(host.deviceType)}</td>
    <td class="ports-cell">${portsHtml(host.openPorts)}</td>
    <td><button class="btn btn-sm btn-secondary detail-btn">Details</button></td>
  `;
  tr.querySelector('.detail-btn').addEventListener('click', () => showDetail(host));
  el.resultsTbody.appendChild(tr);
}

function addToGrid(host) {
  const card = document.createElement('div');
  card.className = 'host-card';
  card.innerHTML = `
    <div class="host-card-ip">${escapeHtml(host.ip)}</div>
    <div class="host-card-hostname">${escapeHtml(host.hostname || 'Unknown')}</div>
    <div class="host-card-type">${escapeHtml(host.deviceType || 'Unknown Device')}</div>
    <div class="host-card-ports">${portsHtml(host.openPorts, 5)}</div>
  `;
  card.addEventListener('click', () => showDetail(host));
  el.resultsGrid.appendChild(card);
}

/* ===== Detail Panel ===== */
function showDetail(host) {
  state.selectedHost = host;
  el.detailTitle.textContent = host.ip;
  el.detailBody.innerHTML = buildDetailHtml(host);
  el.detailPanel.hidden = false;
}

el.detailCloseBtn.addEventListener('click', () => {
  el.detailPanel.hidden = true;
  state.selectedHost = null;
});

function buildDetailHtml(host) {
  const sections = [];

  sections.push(`
    <div class="detail-section">
      <div class="detail-section-title">Host Information</div>
      ${detailRow('IP Address', host.ip)}
      ${detailRow('Hostname', host.hostname || 'Unknown')}
      ${detailRow('MAC Address', host.mac || 'Not resolved')}
      ${detailRow('Device Type', host.deviceType || 'Unknown')}
      ${detailRow('Discovery Method', host.method || 'N/A')}
      ${detailRow('Scanned At', formatDate(host.scannedAt))}
    </div>
  `);

  if (host.openPorts && host.openPorts.length > 0) {
    const portRows = host.openPorts.map((p) => `
      <div class="port-row">
        <div>
          <span class="port-number">${p.port}</span>
          <span class="port-service"> / ${escapeHtml(p.service || 'Unknown')}</span>
          ${p.banner ? `<div class="port-banner" title="${escapeHtml(p.banner)}">${escapeHtml(p.banner)}</div>` : ''}
        </div>
        <span style="color: var(--accent-green); font-size: 11px; font-weight: 600;">OPEN</span>
      </div>
    `).join('');

    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">Open Ports (${host.openPorts.length})</div>
        ${portRows}
      </div>
    `);
  } else {
    sections.push(`
      <div class="detail-section">
        <div class="detail-section-title">Open Ports</div>
        <p class="text-muted">No open ports found</p>
      </div>
    `);
  }

  return sections.join('');
}

function detailRow(key, value) {
  return `
    <div class="detail-row">
      <span class="detail-key">${escapeHtml(key)}</span>
      <span class="detail-val">${escapeHtml(String(value))}</span>
    </div>
  `;
}

/* ===== Export ===== */
el.exportJsonBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.hosts, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `lan-scan-${timestamp()}.json`);
});

el.exportCsvBtn.addEventListener('click', () => {
  const rows = [['IP', 'Hostname', 'MAC', 'Device Type', 'Open Ports', 'Scanned At']];
  for (const h of state.hosts) {
    rows.push([
      h.ip,
      h.hostname || '',
      h.mac || '',
      h.deviceType || '',
      (h.openPorts || []).map((p) => `${p.port}/${p.service}`).join('; '),
      h.scannedAt || '',
    ]);
  }
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `lan-scan-${timestamp()}.csv`);
});

/* ===== Helpers ===== */
function deviceBadgeHtml(type) {
  const t = (type || 'Unknown').toLowerCase();
  let cls = 'device-unknown';
  if (t.includes('windows')) cls = 'device-windows';
  else if (t.includes('linux') || t.includes('unix')) cls = 'device-linux';
  else if (t.includes('apple') || t.includes('mac')) cls = 'device-apple';
  else if (t.includes('router') || t.includes('iot')) cls = 'device-router';
  else if (t.includes('server')) cls = 'device-server';
  else if (t.includes('printer')) cls = 'device-printer';
  return `<span class="device-badge ${cls}">${escapeHtml(type || 'Unknown')}</span>`;
}

function portsHtml(ports, limit) {
  if (!ports || !ports.length) return '<span class="text-muted">None</span>';
  const list = limit ? ports.slice(0, limit) : ports;
  const tags = list.map((p) => `<span class="port-tag" title="${escapeHtml(p.service || '')}">${p.port}</span>`).join('');
  const more = limit && ports.length > limit ? `<span class="text-muted">+${ports.length - limit}</span>` : '';
  return tags + more;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvEscape(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-GB');
}

/* ===== Scan History Modal ===== */
el.historyBtn.addEventListener('click', openHistoryModal);
el.historyCloseBtn.addEventListener('click', () => { el.historyModal.hidden = true; });
el.historyClearBtn.addEventListener('click', async () => {
  await fetch('/api/history', { method: 'DELETE' });
  el.historyBody.innerHTML = '<p class="text-muted">No scan history yet.</p>';
});

el.historyModal.addEventListener('click', (e) => {
  if (e.target === el.historyModal) el.historyModal.hidden = true;
});

async function openHistoryModal() {
  el.historyModal.hidden = false;
  el.historyBody.innerHTML = '<p class="text-muted">Loading...</p>';

  try {
    const res = await fetch('/api/history');
    const { history } = await res.json();

    if (!history.length) {
      el.historyBody.innerHTML = '<p class="text-muted">No scan history yet.</p>';
      return;
    }

    el.historyBody.innerHTML = history.map((entry) => `
      <div class="history-entry">
        <div class="history-entry-meta">
          <div class="history-subnet">${escapeHtml(entry.subnet)}/${escapeHtml(entry.netmask)}</div>
          <div class="history-detail">${formatDate(entry.completedAt)}</div>
          <div class="history-detail">${entry.totalPorts || 0} open ports found</div>
        </div>
        <div class="history-stats">
          <span class="history-stat-value">${entry.hostsFound}</span>
          <span class="history-stat-label">Hosts</span>
        </div>
      </div>
    `).join('');
  } catch {
    el.historyBody.innerHTML = '<p class="text-muted">Failed to load history.</p>';
  }
}

/* ===== Keyboard Shortcuts ===== */
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  if (e.key === 'Enter' && !e.shiftKey && !state.scanning) {
    el.scanBtn.click();
  }

  if (e.key === 'Escape') {
    if (!el.detailPanel.hidden) {
      el.detailPanel.hidden = true;
      state.selectedHost = null;
    }
    if (!el.historyModal.hidden) {
      el.historyModal.hidden = true;
    }
  }

  if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
    openHistoryModal();
  }

  if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
    el.viewTableBtn.click();
  }

  if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
    el.viewGridBtn.click();
  }
});

/* ===== Boot ===== */
connectWS();
