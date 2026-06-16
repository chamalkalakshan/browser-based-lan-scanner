const net = require('net');

const COMMON_PORTS = [
  { port: 21,   service: 'FTP' },
  { port: 22,   service: 'SSH' },
  { port: 23,   service: 'Telnet' },
  { port: 25,   service: 'SMTP' },
  { port: 53,   service: 'DNS' },
  { port: 80,   service: 'HTTP' },
  { port: 110,  service: 'POP3' },
  { port: 135,  service: 'RPC' },
  { port: 139,  service: 'NetBIOS' },
  { port: 143,  service: 'IMAP' },
  { port: 161,  service: 'SNMP' },
  { port: 443,  service: 'HTTPS' },
  { port: 445,  service: 'SMB' },
  { port: 548,  service: 'AFP' },
  { port: 631,  service: 'IPP' },
  { port: 993,  service: 'IMAPS' },
  { port: 995,  service: 'POP3S' },
  { port: 1433, service: 'MSSQL' },
  { port: 1521, service: 'Oracle' },
  { port: 3306, service: 'MySQL' },
  { port: 3389, service: 'RDP' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 5900, service: 'VNC' },
  { port: 6379, service: 'Redis' },
  { port: 8080, service: 'HTTP-Alt' },
  { port: 8443, service: 'HTTPS-Alt' },
  { port: 8888, service: 'HTTP-Dev' },
  { port: 9200, service: 'Elasticsearch' },
  { port: 27017, service: 'MongoDB' },
];

function scanPort(ip, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      socket.destroy();
      resolve({ port, open: true });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ port, open: false });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, open: false });
    });
  });
}

async function scanPorts(ip, ports = COMMON_PORTS, timeoutMs = 1000) {
  const BATCH_SIZE = 10;
  const openPorts = [];

  const portList = ports.map((p) =>
    typeof p === 'number' ? { port: p, service: 'Unknown' } : p
  );

  for (let i = 0; i < portList.length; i += BATCH_SIZE) {
    const batch = portList.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(({ port }) => scanPort(ip, port, timeoutMs))
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].open) {
        openPorts.push({
          port: batch[j].port,
          service: batch[j].service,
          state: 'open',
        });
      }
    }
  }

  return openPorts;
}

module.exports = { scanPorts, scanPort, COMMON_PORTS };
