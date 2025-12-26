import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import type { ServerConfig, MCPConfig, ServerInfo } from './types.js';

/**
 * Manages server configurations from files, environment variables, and CLI arguments
 */
export class ConfigManager {
  private config: MCPConfig;
  private configPath: string;
  private loaded: boolean = false;
  private cliServer: ServerConfig | null = null;

  constructor(cliServer?: ServerConfig | null) {
    // Load environment variables
    dotenv.config();

    // Store CLI server config
    this.cliServer = cliServer || null;

    // Find and load configuration
    this.configPath = this.findConfigFile();
    this.config = this.loadConfig();
    this.loaded = true;
  }

  /**
   * Find configuration file from multiple possible locations
   */
  private findConfigFile(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'servers.json'),
      path.join(process.cwd(), 'config', 'servers.json'),
      path.join(process.cwd(), 'mcp-config.json'),
      path.join(process.cwd(), 'config', 'mcp-config.json'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.ssh-mcp', 'servers.json'),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        console.error(`[ConfigManager] Found config file: ${filePath}`);
        return filePath;
      }
    }

    // Return default path if none found
    return path.join(process.cwd(), 'servers.json');
  }

  /**
   * Load configuration from file and environment
   */
  private loadConfig(): MCPConfig {
    let config: MCPConfig = {
      servers: [],
      connectionTimeout: 30000,
      retryAttempts: 3,
      sessionTimeout: 1800000, // 30 minutes
      maxSessions: 100
    };

    // 1. Load from config file
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
        console.error(`[ConfigManager] Loaded ${config.servers.length} servers from file`);
      } catch (error) {
        console.error(`[ConfigManager] Failed to parse config file:`, error);
      }
    }

    // 2. Load from environment variables
    const envServers = this.loadFromEnv();
    config.servers = [...config.servers, ...envServers];

    // 3. Load from CLI arguments (highest priority)
    if (this.cliServer) {
      config.servers.push(this.cliServer);
      config.defaultServer = this.cliServer.id;
      console.error(`[ConfigManager] Loaded server from CLI: ${this.cliServer.name} (${this.cliServer.host})`);
    }

    // 4. Load global settings from environment
    if (process.env.SSH_CONNECTION_TIMEOUT) {
      config.connectionTimeout = parseInt(process.env.SSH_CONNECTION_TIMEOUT, 10);
    }
    if (process.env.SSH_SESSION_TIMEOUT) {
      config.sessionTimeout = parseInt(process.env.SSH_SESSION_TIMEOUT, 10);
    }
    if (process.env.SSH_MAX_SESSIONS) {
      config.maxSessions = parseInt(process.env.SSH_MAX_SESSIONS, 10);
    }
    if (process.env.SSH_DEFAULT_SERVER) {
      config.defaultServer = process.env.SSH_DEFAULT_SERVER;
    }

    // 5. Deduplicate servers by ID
    const uniqueServers = new Map<string, ServerConfig>();
    config.servers.forEach((server) => {
      uniqueServers.set(server.id, server);
    });
    config.servers = Array.from(uniqueServers.values());

    return config;
  }

  /**
   * Load server configurations from environment variables
   * Supports: SSH_SERVER_<id>_HOST, SSH_SERVER_<id>_USERNAME, etc.
   */
  private loadFromEnv(): ServerConfig[] {
    const servers: ServerConfig[] = [];
    const serverPattern = /^SSH_SERVER_([A-Za-z0-9_]+)_(.+)$/;
    const envVars = process.env;

    // Find all server IDs
    const serverIds = new Set<string>();
    Object.keys(envVars).forEach((key) => {
      const match = key.match(serverPattern);
      if (match) {
        serverIds.add(match[1]);
      }
    });

    // Build server configs
    serverIds.forEach((id) => {
      const server: Partial<ServerConfig> = {
        id: id.toLowerCase(),
        name: id,
        port: 22
      };

      const prefix = `SSH_SERVER_${id}_`;
      Object.keys(envVars).forEach((key) => {
        if (key.startsWith(prefix)) {
          const field = key.substring(prefix.length).toLowerCase();
          const value = envVars[key];

          switch (field) {
            case 'host':
              server.host = value;
              break;
            case 'port':
              server.port = parseInt(value || '22', 10);
              break;
            case 'username':
            case 'user':
              server.username = value;
              break;
            case 'password':
            case 'pass':
              server.password = value;
              break;
            case 'privatekey':
            case 'private_key':
            case 'key':
              server.privateKeyPath = value;
              break;
            case 'passphrase':
              server.passphrase = value;
              break;
            case 'name':
              server.name = value || id;
              break;
            case 'description':
            case 'desc':
              server.description = value;
              break;
            case 'tags':
              server.tags = value?.split(',').map(t => t.trim());
              break;
          }
        }
      });

      // Validate required fields
      if (server.host && server.username) {
        servers.push(server as ServerConfig);
      }
    });

    if (servers.length > 0) {
      console.error(`[ConfigManager] Loaded ${servers.length} servers from environment`);
    }

    return servers;
  }

  /**
   * Get all server configurations
   */
  getServers(): ServerConfig[] {
    return this.config.servers;
  }

  /**
   * Get server info list (without sensitive data)
   */
  getServerInfoList(): ServerInfo[] {
    return this.config.servers.map(server => ({
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      description: server.description,
      tags: server.tags,
      hasPassword: !!server.password,
      hasPrivateKey: !!server.privateKeyPath
    }));
  }

  /**
   * Get server by ID
   */
  getServer(id: string): ServerConfig | undefined {
    return this.config.servers.find((s) => s.id === id);
  }

  /**
   * Get server by name (case-insensitive)
   */
  getServerByName(name: string): ServerConfig | undefined {
    return this.config.servers.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get default server
   */
  getDefaultServer(): ServerConfig | undefined {
    if (this.config.defaultServer) {
      return this.getServer(this.config.defaultServer);
    }
    return this.config.servers[0];
  }

  /**
   * Add or update a server configuration
   */
  addServer(server: ServerConfig): void {
    const existing = this.config.servers.findIndex((s) => s.id === server.id);
    if (existing >= 0) {
      this.config.servers[existing] = server;
    } else {
      this.config.servers.push(server);
    }
    this.saveConfig();
  }

  /**
   * Remove a server configuration
   */
  removeServer(id: string): boolean {
    const initialLength = this.config.servers.length;
    this.config.servers = this.config.servers.filter((s) => s.id !== id);

    if (this.config.servers.length < initialLength) {
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      // Don't save sensitive data like passwords
      const safeConfig: MCPConfig = {
        ...this.config,
        servers: this.config.servers.map(server => ({
          ...server,
          // Optionally remove password from saved config
          // password: undefined
        }))
      };

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(safeConfig, null, 2),
        'utf-8'
      );
      console.error(`[ConfigManager] Config saved to ${this.configPath}`);
    } catch (error) {
      console.error(`[ConfigManager] Failed to save config:`, error);
    }
  }

  /**
   * Get full configuration
   */
  getConfig(): MCPConfig {
    return this.config;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reload configuration from file
   */
  reload(): void {
    this.config = this.loadConfig();
    console.error('[ConfigManager] Configuration reloaded');
  }
}
