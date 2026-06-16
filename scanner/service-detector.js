const net = require('net');
const { exec } = require('child_process');

const BANNER_TIMEOUT_MS = 2000;

function grabBanner(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(BANNER_TIMEOUT_MS);

    let banner = '';

    socket.connect(port, ip, () => {
      if ([80, 8080, 8443, 443].includes(port)) {
        socket.write(`HEAD / HTTP/1.0\r\nHost: ${ip}\r\n\r\n`);
      }
    });

    socket.on('data', (data) => {
      banner += data.toString('utf8', 0, 256);
      socket.destroy();
    });

    socket.on('close', () => {
      resolve(banner.trim().split('\n')[0].substring(0, 100) || null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(banner.trim().split('\n')[0].substring(0, 100) || null);
    });
  });
}

function resolveHostname(ip) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `nslookup ${ip}` : `host ${ip}`;

    exec(cmd, { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      if (isWin) {
        const match = stdout.match(/Name:\s+(.+)/);
        resolve(match ? match[1].trim() : null);
      } else {
        const match = stdout.match(/pointer\s+(.+)\./);
        resolve(match ? match[1].trim() : null);
      }
    });
  });
}

function getMacAddress(ip) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }
    exec(`arp -a ${ip}`, { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const match = stdout.match(/([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i);
      resolve(match ? match[0].toLowerCase() : null);
    });
  });
}

function guessDeviceType(openPorts, hostname) {
  const portNums = openPorts.map((p) => p.port);
  const h = (hostname || '').toLowerCase();

  if (portNums.includes(3389) || portNums.includes(445)) return 'Windows PC';
  if (portNums.includes(22) && portNums.includes(80)) return 'Linux Server';
  if (portNums.includes(22) && !portNums.includes(80)) return 'Linux/Unix Host';
  if (portNums.includes(548) || h.includes('apple') || h.includes('mac')) return 'Apple Device';
  if (portNums.includes(9100)) return 'Printer';
  if (portNums.includes(1900) || portNums.includes(8080)) return 'Router/IoT Device';
  if (portNums.includes(80) || portNums.includes(443)) return 'Web Server';
  if (openPorts.length === 0) return 'Unknown Device';
  return 'Network Device';
}

async function enrichHost(host) {
  const [hostname, mac] = await Promise.all([
    resolveHostname(host.ip),
    getMacAddress(host.ip),
  ]);

  return {
    ...host,
    hostname: hostname || null,
    mac: mac || null,
  };
}

module.exports = { grabBanner, resolveHostname, getMacAddress, guessDeviceType, enrichHost };
