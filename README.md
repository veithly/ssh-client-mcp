# SSH/SFTP MCP Server

[![npm version](https://badge.fury.io/js/ssh-client-mcp.svg)](https://www.npmjs.com/package/ssh-client-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English** | [中文](./README.zh-CN.md)

A Model Context Protocol (MCP) server that enables AI assistants like Claude to execute SSH commands and perform SFTP file operations on remote servers.

## Features

- **Server Configuration Management** - Define servers in config files or environment variables
- **Connection Testing** - Test server connectivity before establishing sessions
- **SSH Command Execution** - Run commands remotely with optional sudo support
- **SFTP File Operations** - Upload, download, list, create, and delete files/directories
- **Session Management** - Auto-cleanup of idle sessions, connection pooling
- **Multiple Auth Methods** - Password and private key authentication

## Installation

### Using npx (Recommended)

```bash
npx ssh-client-mcp
```

### Using npm

```bash
npm install -g ssh-client-mcp
```

### From Source

```bash
git clone https://github.com/veithly/ssh-client-mcp.git
cd ssh-client-mcp
npm install
npm run build
```

## Quick Start

### Configure Claude Desktop

Add to your Claude Desktop configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Option 1: CLI Arguments (Recommended)

Configure server directly via command line arguments:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "ssh-client-mcp",
        "--host", "192.168.1.100",
        "--user", "admin",
        "--password", "your-password"
      ]
    }
  }
}
```

With private key authentication:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "ssh-client-mcp",
        "--host", "192.168.1.100",
        "--user", "admin",
        "--key", "~/.ssh/id_rsa"
      ]
    }
  }
}
```

With private key + passphrase:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "ssh-client-mcp",
        "--host", "192.168.1.100",
        "--user", "admin",
        "--key", "~/.ssh/id_rsa",
        "--passphrase", "your-key-passphrase"
      ]
    }
  }
}
```

**Available CLI Arguments:**

| Argument | Short | Description |
|----------|-------|-------------|
| `--host` | `-h` | Server hostname or IP |
| `--port` | `-p` | SSH port (default: 22) |
| `--user` | `-u` | SSH username |
| `--password` | | SSH password |
| `--key` | `-k` | Path to private key file |
| `--passphrase` | | Passphrase for private key |
| `--id` | | Server ID (default: "cli") |
| `--name` | | Server display name |

#### Option 2: Config File

Create a `servers.json` file in the working directory:

```json
{
  "servers": [
    {
      "id": "my-server",
      "name": "My Server",
      "host": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "password": "your-password"
    }
  ],
  "defaultServer": "my-server"
}
```

#### Option 3: Environment Variables

```bash
SSH_SERVER_DEV_HOST=192.168.1.100
SSH_SERVER_DEV_PORT=22
SSH_SERVER_DEV_USERNAME=admin
SSH_SERVER_DEV_PASSWORD=your-password
SSH_SERVER_DEV_NAME=Development Server
```

Then restart Claude Desktop to load the MCP server.

## Available Tools (18 total)

### Server Management

| Tool | Description |
|------|-------------|
| `ssh_list_servers` | List all configured servers |
| `ssh_get_server` | Get details of a specific server |
| `ssh_test_connection` | Test connection to a server |
| `ssh_test_all_connections` | Test all configured servers |
| `ssh_connect_by_id` | Connect using server ID from config |

### Connection Management

| Tool | Description |
|------|-------------|
| `ssh_connect` | Establish SSH connection with credentials |
| `ssh_disconnect` | Close an SSH session |
| `ssh_list_sessions` | List all active SSH sessions |

### Command Execution

| Tool | Description |
|------|-------------|
| `ssh_exec` | Execute a command on the remote server |
| `ssh_sudo_exec` | Execute a command with sudo privileges |

### File Operations (SFTP)

| Tool | Description |
|------|-------------|
| `sftp_upload` | Upload a local file to the remote server |
| `sftp_download` | Download a file from the remote server |
| `sftp_ls` | List contents of a remote directory |
| `sftp_mkdir` | Create a directory on the remote server |
| `sftp_rm` | Remove a file or directory |
| `sftp_stat` | Get file/directory information |
| `sftp_read` | Read contents of a remote file |
| `sftp_write` | Write content to a remote file |

## Usage Examples

### List Configured Servers

```
Tool: ssh_list_servers
Arguments: {}
```

### Test Connection

```
Tool: ssh_test_connection
Arguments: {
  "serverId": "my-server"
}
```

### Connect to Server

```
Tool: ssh_connect_by_id
Arguments: {
  "serverId": "my-server"
}
```

### Execute Command

```
Tool: ssh_exec
Arguments: {
  "sessionId": "<session-id>",
  "command": "ls -la /home"
}
```

### Upload File

```
Tool: sftp_upload
Arguments: {
  "sessionId": "<session-id>",
  "localPath": "/local/path/file.txt",
  "remotePath": "/remote/path/file.txt"
}
```

### Download File

```
Tool: sftp_download
Arguments: {
  "sessionId": "<session-id>",
  "remotePath": "/remote/path/file.txt",
  "localPath": "/local/path/file.txt"
}
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_TIMEOUT` | Session timeout in milliseconds | `1800000` (30 min) |
| `MAX_SESSIONS` | Maximum concurrent sessions | `100` |
| `SSH_CONNECTION_TIMEOUT` | Connection timeout in milliseconds | `30000` |
| `SSH_DEFAULT_SERVER` | Default server ID | - |

### Server Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique server identifier |
| `name` | string | Yes | Display name |
| `host` | string | Yes | Hostname or IP address |
| `port` | number | No | SSH port (default: 22) |
| `username` | string | Yes | SSH username |
| `password` | string | No* | SSH password |
| `privateKeyPath` | string | No* | Path to private key file |
| `passphrase` | string | No | Passphrase for private key |
| `description` | string | No | Server description |
| `tags` | string[] | No | Tags for filtering |

*Either `password` or `privateKeyPath` must be provided.

## Security Considerations

- Sessions auto-expire after 30 minutes of inactivity
- Maximum session limit prevents resource exhaustion
- Credentials are not stored persistently
- Sudo passwords are not logged
- Use SSH keys instead of passwords when possible

## Development

```bash
# Clone the repository
git clone https://github.com/veithly/ssh-client-mcp.git
cd ssh-client-mcp

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Clean build
npm run clean
```

## Project Structure

```
ssh-client-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # Type definitions
│   ├── SessionManager.ts     # SSH session lifecycle
│   ├── SSHExecutor.ts        # Command execution
│   ├── SFTPOperations.ts     # SFTP file operations
│   ├── ConnectionTester.ts   # Connection testing
│   ├── config/
│   │   ├── ConfigManager.ts  # Configuration management
│   │   ├── types.ts          # Config types
│   │   └── index.ts          # Config exports
│   └── tools/
│       ├── connection.ts     # Connection tools
│       ├── command.ts        # Command tools
│       ├── file.ts           # File tools
│       ├── server.ts         # Server management tools
│       └── index.ts          # Tool exports
├── servers.example.json      # Example server config
├── .env.example              # Example environment config
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT © 2024

## Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) - The MCP SDK
- [ssh2](https://github.com/mscdex/ssh2) - SSH2 client library for Node.js

---

Made for Claude AI
