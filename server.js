const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { getLocalNetworkInfo, getHostsInSubnet } = require('./scanner/network-utils');
const { discoverHosts } = require('./scanner/host-discovery');
const { scanPorts } = require('./scanner/port-scanner');
const { enrichHost, grabBanner, guessDeviceType } = require('./scanner/service-detector');
const { loadHistory, saveHistory } = require('./scanner/scan-history');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/network-info', (req, res) => {
  const interfaces = getLocalNetworkInfo();
  res.json({ interfaces });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'running', port: PORT });
});

app.get('/api/history', (req, res) => {
  res.json({ history: loadHistory() });
});

app.delete('/api/history', (req, res) => {
  const { clearHistory } = require('./scanner/scan-history');
  clearHistory();
  res.json({ ok: true });
});

function broadcast(ws, type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.aborted = false;
  broadcast(ws, 'connected', { message: 'Connected to LAN Scanner server' });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      broadcast(ws, 'error', { message: 'Invalid JSON message' });
      return;
    }

    if (msg.type === 'start-scan') {
      ws.aborted = false;
      await handleScan(ws, msg.data || {});
    }

    if (msg.type === 'abort-scan') {
      ws.aborted = true;
      broadcast(ws, 'scan-aborted', { message: 'Scan aborted by user' });
    }
  });

  ws.on('close', () => {
    ws.aborted = true;
    console.log('Client disconnected');
  });
});

async function handleScan(ws, options) {
  const { subnet, netmask, scanPorts: doPortScan = true, timeoutMs = 1000 } = options;

  broadcast(ws, 'scan-start', { message: 'Resolving network information...' });

  let targetSubnet = subnet;
  let targetMask = netmask || '255.255.255.0';

  if (!targetSubnet) {
    const interfaces = getLocalNetworkInfo();
    if (interfaces.length === 0) {
      broadcast(ws, 'scan-error', { message: 'No network interfaces found' });
      return;
    }
    const iface = interfaces[0];
    targetSubnet = iface.subnet;
    targetMask = iface.netmask;
    broadcast(ws, 'scan-info', {
      message: `Scanning subnet ${targetSubnet}/${targetMask} via ${iface.name}`,
      interface: iface,
    });
  }

  const ipList = getHostsInSubnet(targetSubnet, targetMask);
  broadcast(ws, 'scan-info', {
    message: `Discovering hosts across ${ipList.length} addresses...`,
    total: ipList.length,
  });

  const aliveHosts = await discoverHosts(ipList, (progress) => {
    broadcast(ws, 'discovery-progress', progress);
  });

  broadcast(ws, 'discovery-complete', {
    message: `Found ${aliveHosts.length} active host(s)`,
    count: aliveHosts.length,
  });

  if (aliveHosts.length === 0) {
    broadcast(ws, 'scan-complete', { hosts: [] });
    return;
  }

  const enrichedHosts = [];

  for (const host of aliveHosts) {
    if (ws.aborted) {
      broadcast(ws, 'scan-aborted', { message: 'Scan aborted' });
      return;
    }

    broadcast(ws, 'enriching-host', { ip: host.ip, message: `Enriching ${host.ip}...` });

    const enriched = await enrichHost(host);

    let openPorts = [];
    if (doPortScan && !ws.aborted) {
      broadcast(ws, 'port-scan-start', { ip: host.ip });
      openPorts = await scanPorts(host.ip, undefined, timeoutMs);

      for (const p of openPorts) {
        if (ws.aborted) break;
        const banner = await grabBanner(host.ip, p.port);
        if (banner) p.banner = banner;
      }
    }

    const deviceType = guessDeviceType(openPorts, enriched.hostname);

    const result = {
      ...enriched,
      openPorts,
      deviceType,
      scannedAt: new Date().toISOString(),
    };

    enrichedHosts.push(result);
    broadcast(ws, 'host-result', result);
  }

  const completedAt = new Date().toISOString();
  const totalPorts = enrichedHosts.reduce((sum, h) => sum + h.openPorts.length, 0);

  saveHistory({
    subnet: targetSubnet,
    netmask: targetMask,
    hostsFound: enrichedHosts.length,
    totalPorts,
    startedAt: new Date(Date.now() - (enrichedHosts.length * 2000)).toISOString(),
    completedAt,
    durationMs: enrichedHosts.length * 2000,
  });

  broadcast(ws, 'scan-complete', {
    message: `Scan complete. Found ${enrichedHosts.length} host(s).`,
    hosts: enrichedHosts,
    summary: {
      total: ipList.length,
      alive: enrichedHosts.length,
      totalPorts,
      completedAt,
    },
  });
}

server.listen(PORT, () => {
  console.log(`LAN Scanner running at http://localhost:${PORT}`);
});
