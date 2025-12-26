# SSH/SFTP MCP Server

[![npm version](https://badge.fury.io/js/ssh-client-mcp.svg)](https://www.npmjs.com/package/ssh-client-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个 MCP (Model Context Protocol) 服务器，让 Claude 等 AI 助手能够通过 SSH 执行远程命令和进行 SFTP 文件操作。

[English](./README.md) | **中文**

## 功能特性

- **服务器配置管理** - 支持通过命令行参数、配置文件或环境变量配置服务器
- **连接测试** - 在建立会话前测试服务器连通性
- **SSH 命令执行** - 远程执行命令，支持 sudo
- **SFTP 文件操作** - 上传、下载、列表、创建、删除文件和目录
- **会话管理** - 自动清理空闲会话，连接池管理
- **多种认证方式** - 支持密码和私钥认证

## 安装

### 使用 npx (推荐)

```bash
npx ssh-client-mcp --host 192.168.1.100 --user admin --key ~/.ssh/id_rsa
```

### 使用 npm 全局安装

```bash
npm install -g ssh-client-mcp
```

### 从源码安装

```bash
git clone https://github.com/veithly/ssh-client-mcp.git
cd ssh-client-mcp
npm install
npm run build
```

## 快速开始

### 配置 Claude Desktop

将以下配置添加到 Claude Desktop 配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### 方式一：命令行参数 (推荐)

直接通过命令行参数配置服务器：

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

使用私钥认证：

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

使用私钥 + 密码短语：

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

**可用的命令行参数：**

| 参数 | 简写 | 说明 |
|------|------|------|
| `--host` | `-h` | 服务器主机名或 IP |
| `--port` | `-p` | SSH 端口 (默认: 22) |
| `--user` | `-u` | SSH 用户名 |
| `--password` | | SSH 密码 |
| `--key` | `-k` | 私钥文件路径 |
| `--passphrase` | | 私钥密码短语 |
| `--id` | | 服务器 ID (默认: "cli") |
| `--name` | | 服务器显示名称 |

#### 方式二：配置文件

在工作目录创建 `servers.json` 文件：

```json
{
  "servers": [
    {
      "id": "my-server",
      "name": "我的服务器",
      "host": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "password": "your-password"
    }
  ],
  "defaultServer": "my-server"
}
```

#### 方式三：环境变量

```bash
SSH_SERVER_DEV_HOST=192.168.1.100
SSH_SERVER_DEV_PORT=22
SSH_SERVER_DEV_USERNAME=admin
SSH_SERVER_DEV_PASSWORD=your-password
SSH_SERVER_DEV_NAME=开发服务器
```

配置完成后重启 Claude Desktop 以加载 MCP 服务器。

## 可用工具 (共 18 个)

### 服务器管理

| 工具 | 说明 |
|------|------|
| `ssh_list_servers` | 列出所有配置的服务器 |
| `ssh_get_server` | 获取指定服务器的详细信息 |
| `ssh_test_connection` | 测试服务器连接 |
| `ssh_test_all_connections` | 测试所有配置的服务器 |
| `ssh_connect_by_id` | 通过服务器 ID 连接 |

### 连接管理

| 工具 | 说明 |
|------|------|
| `ssh_connect` | 使用凭据建立 SSH 连接 |
| `ssh_disconnect` | 关闭 SSH 会话 |
| `ssh_list_sessions` | 列出所有活动的 SSH 会话 |

### 命令执行

| 工具 | 说明 |
|------|------|
| `ssh_exec` | 在远程服务器上执行命令 |
| `ssh_sudo_exec` | 以 sudo 权限执行命令 |

### 文件操作 (SFTP)

| 工具 | 说明 |
|------|------|
| `sftp_upload` | 上传本地文件到远程服务器 |
| `sftp_download` | 从远程服务器下载文件 |
| `sftp_ls` | 列出远程目录内容 |
| `sftp_mkdir` | 在远程服务器创建目录 |
| `sftp_rm` | 删除文件或目录 |
| `sftp_stat` | 获取文件/目录信息 |
| `sftp_read` | 读取远程文件内容 |
| `sftp_write` | 写入内容到远程文件 |

## 使用示例

### 列出配置的服务器

```
工具: ssh_list_servers
参数: {}
```

### 测试连接

```
工具: ssh_test_connection
参数: {
  "serverId": "my-server"
}
```

### 连接到服务器

```
工具: ssh_connect_by_id
参数: {
  "serverId": "my-server"
}
```

### 执行命令

```
工具: ssh_exec
参数: {
  "sessionId": "<session-id>",
  "command": "ls -la /home"
}
```

### 上传文件

```
工具: sftp_upload
参数: {
  "sessionId": "<session-id>",
  "localPath": "/local/path/file.txt",
  "remotePath": "/remote/path/file.txt"
}
```

### 下载文件

```
工具: sftp_download
参数: {
  "sessionId": "<session-id>",
  "remotePath": "/remote/path/file.txt",
  "localPath": "/local/path/file.txt"
}
```

## 配置选项

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SESSION_TIMEOUT` | 会话超时时间（毫秒） | `1800000` (30分钟) |
| `MAX_SESSIONS` | 最大并发会话数 | `100` |
| `SSH_CONNECTION_TIMEOUT` | 连接超时时间（毫秒） | `30000` |
| `SSH_DEFAULT_SERVER` | 默认服务器 ID | - |

### 服务器配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一服务器标识符 |
| `name` | string | 是 | 显示名称 |
| `host` | string | 是 | 主机名或 IP 地址 |
| `port` | number | 否 | SSH 端口（默认: 22） |
| `username` | string | 是 | SSH 用户名 |
| `password` | string | 否* | SSH 密码 |
| `privateKeyPath` | string | 否* | 私钥文件路径 |
| `passphrase` | string | 否 | 私钥密码短语 |
| `description` | string | 否 | 服务器描述 |
| `tags` | string[] | 否 | 用于过滤的标签 |

*`password` 或 `privateKeyPath` 必须提供其一。

## 安全注意事项

- 会话在空闲 30 分钟后自动过期
- 最大会话限制防止资源耗尽
- 凭据不会持久化存储
- sudo 密码不会被记录
- 建议使用 SSH 密钥而非密码

## 开发

```bash
# 克隆仓库
git clone https://github.com/veithly/ssh-client-mcp.git
cd ssh-client-mcp

# 安装依赖
npm install

# 构建
npm run build

# 监视模式
npm run dev

# 清理构建
npm run clean
```

## 项目结构

```
ssh-client-mcp/
├── src/
│   ├── index.ts              # MCP 服务器入口
│   ├── types.ts              # 类型定义
│   ├── SessionManager.ts     # SSH 会话生命周期
│   ├── SSHExecutor.ts        # 命令执行
│   ├── SFTPOperations.ts     # SFTP 文件操作
│   ├── ConnectionTester.ts   # 连接测试
│   ├── config/
│   │   ├── ConfigManager.ts  # 配置管理
│   │   ├── types.ts          # 配置类型
│   │   └── index.ts          # 配置导出
│   └── tools/
│       ├── connection.ts     # 连接工具
│       ├── command.ts        # 命令工具
│       ├── file.ts           # 文件工具
│       ├── server.ts         # 服务器管理工具
│       └── index.ts          # 工具导出
├── servers.example.json      # 服务器配置示例
├── .env.example              # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

## 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

MIT

## 致谢

- [Model Context Protocol](https://github.com/modelcontextprotocol) - MCP SDK
- [ssh2](https://github.com/mscdex/ssh2) - Node.js SSH2 客户端库

---

为 Claude AI 打造
