const os = require('os');

function getLocalNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
          cidr: iface.cidr,
          subnet: getSubnetBase(iface.address, iface.netmask),
        });
      }
    }
  }

  return results;
}

function getSubnetBase(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  return ipParts.map((part, i) => part & maskParts[i]).join('.');
}

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

function getHostsInSubnet(networkAddress, netmask) {
  const networkInt = ipToInt(networkAddress);
  const maskInt = ipToInt(netmask);
  const hostBits = ~maskInt >>> 0;
  const firstHost = (networkInt & maskInt) + 1;
  const lastHost = (networkInt | hostBits) - 1;

  const hosts = [];
  for (let i = firstHost; i <= lastHost && hosts.length < 254; i++) {
    hosts.push(intToIp(i));
  }
  return hosts;
}

module.exports = { getLocalNetworkInfo, getHostsInSubnet, getSubnetBase };
