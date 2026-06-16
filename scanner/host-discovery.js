const { exec } = require('child_process');
const net = require('net');

const PING_TIMEOUT_MS = 1000;
const TCP_PROBE_TIMEOUT_MS = 500;
const PROBE_PORTS = [80, 443, 22, 445, 139, 3389, 8080, 8443];

function pingHost(ip) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `ping -n 1 -w ${PING_TIMEOUT_MS} ${ip}`
      : `ping -c 1 -W 1 ${ip}`;

    exec(cmd, (error, stdout) => {
      if (error) {
        resolve({ ip, alive: false, method: 'ping' });
        return;
      }
      const alive = isWin
        ? stdout.includes('TTL=') || stdout.includes('ttl=')
        : stdout.includes('1 received') || stdout.includes('1 packets received');
      resolve({ ip, alive, method: 'ping' });
    });
  });
}

function tcpProbeHost(ip) {
  return new Promise((resolve) => {
    let found = false;
    let pending = PROBE_PORTS.length;

    function check() {
      pending--;
      if (pending === 0 && !found) {
        resolve({ ip, alive: false, method: 'tcp' });
      }
    }

    for (const port of PROBE_PORTS) {
      const socket = new net.Socket();
      socket.setTimeout(TCP_PROBE_TIMEOUT_MS);

      socket.connect(port, ip, () => {
        if (!found) {
          found = true;
          resolve({ ip, alive: true, method: 'tcp', openPort: port });
        }
        socket.destroy();
      });

      socket.on('error', () => {
        socket.destroy();
        check();
      });

      socket.on('timeout', () => {
        socket.destroy();
        check();
      });
    }
  });
}

async function discoverHost(ip) {
  const pingResult = await pingHost(ip);
  if (pingResult.alive) return pingResult;

  const tcpResult = await tcpProbeHost(ip);
  return tcpResult;
}

async function discoverHosts(ipList, onProgress) {
  const BATCH_SIZE = 20;
  const results = [];
  let completed = 0;

  for (let i = 0; i < ipList.length; i += BATCH_SIZE) {
    const batch = ipList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(discoverHost));

    for (const result of batchResults) {
      results.push(result);
      completed++;
      if (onProgress) {
        onProgress({
          completed,
          total: ipList.length,
          current: result,
          percent: Math.round((completed / ipList.length) * 100),
        });
      }
    }
  }

  return results.filter((r) => r.alive);
}

module.exports = { discoverHosts, discoverHost, pingHost };
