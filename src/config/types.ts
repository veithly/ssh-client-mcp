/**
 * Server configuration for SSH connection
 */
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  description?: string;
  tags?: string[];
}

/**
 * MCP configuration with multiple servers
 */
export interface MCPConfig {
  servers: ServerConfig[];
  defaultServer?: string;
  connectionTimeout?: number;
  retryAttempts?: number;
  sessionTimeout?: number;
  maxSessions?: number;
}

/**
 * Connection status after testing
 */
export interface ConnectionStatus {
  serverId: string;
  serverName?: string;
  host?: string;
  connected: boolean;
  lastChecked: Date;
  latencyMs?: number;
  error?: string;
  capabilities: {
    ssh: boolean;
    sftp: boolean;
  };
}

/**
 * Server info for listing
 */
export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  description?: string;
  tags?: string[];
  hasPassword: boolean;
  hasPrivateKey: boolean;
}
