# Browser-Based LAN Scanner

A browser-based tool for discovering and analyzing devices on your local area network. Run a lightweight Node.js server and access the scanner from any browser on the same machine.

## Features

- **Host Discovery** - Finds live hosts using ping sweep with TCP fallback probing
- **Port Scanning** - Scans 29 common service ports per discovered host
- **Service Detection** - Grabs banners from open ports to identify running services
- **Hostname Resolution** - Reverse DNS lookup for discovered hosts
- **MAC Address Resolution** - ARP table lookup (Windows)
- **Device Type Detection** - Heuristic classification (Windows PC, Linux Server, Router, Printer, etc.)
- **Real-time Updates** - WebSocket-powered live progress and results
- **Table and Grid Views** - Switch between detailed table and compact card grid
- **Export Results** - Download scan results as JSON or CSV

## Screenshots

Open `http://localhost:3000` after starting the server to see the dark-themed UI with live scan output.

## Requirements

- Node.js 16 or later
- Windows, macOS, or Linux

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/browser-based-lan-scanner.git
cd browser-based-lan-scanner
npm install
```

## Usage

```bash
npm start
```

Then open your browser to `http://localhost:3000`.

### Running a Scan

1. The sidebar will auto-detect your network interfaces
2. Click an interface card to pre-fill the subnet
3. Toggle port scanning on/off as needed
4. Click **Start Scan**
5. Watch live results appear in the table or grid view
6. Click **Details** on any host for full information
7. Export results via JSON or CSV buttons

### Custom Port

```bash
PORT=8080 npm start
```

## Project Structure

```
browser-based-lan-scanner/
|-- server.js               # Express + WebSocket server
|-- scanner/
|   |-- network-utils.js    # Subnet and IP math
|   |-- host-discovery.js   # Ping and TCP probe sweep
|   |-- port-scanner.js     # TCP port scanning
|   `-- service-detector.js # Banner grabbing, hostname, MAC lookup
`-- public/
    |-- index.html
    |-- css/style.css
    `-- js/app.js
```

## How It Works

1. The Node.js server calculates the list of host IPs in the target subnet
2. Hosts are probed in batches of 20 using `ping` (system command) with TCP fallback on common ports
3. Each discovered host is enriched: hostname via DNS, MAC via ARP, open ports via TCP connect scan
4. Results are streamed to the browser in real-time over WebSocket

## Notes

- This tool is intended for use on networks you own or have permission to scan
- Port scanning and host discovery generate network traffic that may be logged by routers and firewalls
- MAC address resolution only works for hosts on the same subnet segment

## License

MIT
