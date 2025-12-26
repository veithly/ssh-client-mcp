import { z } from 'zod';
import type { ConfigManager } from '../config/ConfigManager.js';
import type { SessionManager } from '../SessionManager.js';
import { ConnectionTester } from '../ConnectionTester.js';

/**
 * Server tool schemas
 */
export const listServersSchema = z.object({
  tag: z.string().optional().describe('Filter servers by tag')
});

export const getServerSchema = z.object({
  serverId: z.string().describe('Server ID to get details for')
});

export const testConnectionSchema = z.object({
  serverId: z.string().describe('Server ID to test connection')
});

export const testAllConnectionsSchema = z.object({
  parallel: z.boolean().optional().default(false).describe('Test connections in parallel')
});

export const connectByIdSchema = z.object({
  serverId: z.string().describe('Server ID from configuration'),
  passwordOverride: z.string().optional().describe('Override password from config')
});

export type ListServersInput = z.infer<typeof listServersSchema>;
export type GetServerInput = z.infer<typeof getServerSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type TestAllConnectionsInput = z.infer<typeof testAllConnectionsSchema>;
export type ConnectByIdInput = z.infer<typeof connectByIdSchema>;

/**
 * Server tool handlers
 */
export function createServerTools(
  configManager: ConfigManager,
  sessionManager: SessionManager
) {
  const connectionTester = new ConnectionTester();

  return {
    /**
     * List configured servers
     */
    async listServers(input: ListServersInput): Promise<string> {
      let servers = configManager.getServerInfoList();

      // Filter by tag if provided
      if (input.tag) {
        servers = servers.filter(
          (s) => s.tags?.some((t) => t.toLowerCase() === input.tag?.toLowerCase())
        );
      }

      return JSON.stringify({
        success: true,
        count: servers.length,
        servers: servers.map((s) => ({
          id: s.id,
          name: s.name,
          host: s.host,
          port: s.port,
          username: s.username,
          description: s.description,
          tags: s.tags,
          authMethod: s.hasPrivateKey ? 'privateKey' : s.hasPassword ? 'password' : 'none'
        }))
      });
    },

    /**
     * Get server details
     */
    async getServer(input: GetServerInput): Promise<string> {
      const server = configManager.getServer(input.serverId);

      if (!server) {
        return JSON.stringify({
          success: false,
          error: `Server not found: ${input.serverId}`
        });
      }

      return JSON.stringify({
        success: true,
        server: {
          id: server.id,
          name: server.name,
          host: server.host,
          port: server.port,
          username: server.username,
          description: server.description,
          tags: server.tags,
          authMethod: server.privateKeyPath ? 'privateKey' : server.password ? 'password' : 'none',
          privateKeyPath: server.privateKeyPath ? '***configured***' : undefined
        }
      });
    },

    /**
     * Test connection to a server
     */
    async testConnection(input: TestConnectionInput): Promise<string> {
      const server = configManager.getServer(input.serverId);

      if (!server) {
        return JSON.stringify({
          success: false,
          error: `Server not found: ${input.serverId}`
        });
      }

      const status = await connectionTester.testConnection(server);

      return JSON.stringify({
        success: status.connected,
        serverId: status.serverId,
        serverName: status.serverName,
        host: status.host,
        connected: status.connected,
        latencyMs: status.latencyMs,
        capabilities: status.capabilities,
        error: status.error,
        checkedAt: status.lastChecked.toISOString()
      });
    },

    /**
     * Test all configured servers
     */
    async testAllConnections(input: TestAllConnectionsInput): Promise<string> {
      const servers = configManager.getServers();

      if (servers.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No servers configured'
        });
      }

      const results = input.parallel
        ? await connectionTester.testAllConnectionsParallel(servers)
        : await connectionTester.testAllConnections(servers);

      const summary = {
        total: results.length,
        connected: results.filter((r) => r.connected).length,
        failed: results.filter((r) => !r.connected).length
      };

      return JSON.stringify({
        success: true,
        summary,
        results: results.map((r) => ({
          serverId: r.serverId,
          serverName: r.serverName,
          host: r.host,
          connected: r.connected,
          latencyMs: r.latencyMs,
          capabilities: r.capabilities,
          error: r.error
        }))
      });
    },

    /**
     * Connect using server ID from configuration
     */
    async connectById(input: ConnectByIdInput): Promise<string> {
      const server = configManager.getServer(input.serverId);

      if (!server) {
        return JSON.stringify({
          success: false,
          error: `Server not found: ${input.serverId}`
        });
      }

      // Use password override if provided
      const password = input.passwordOverride || server.password;

      const sessionId = await sessionManager.createSession({
        host: server.host,
        port: server.port,
        username: server.username,
        password,
        privateKey: server.privateKeyPath,
        privateKeyPassphrase: server.passphrase
      });

      return JSON.stringify({
        success: true,
        sessionId,
        serverId: server.id,
        serverName: server.name,
        message: `Connected to ${server.name} (${server.username}@${server.host}:${server.port})`
      });
    }
  };
}

/**
 * Server tool definitions for MCP
 */
export const serverToolDefinitions = [
  {
    name: 'ssh_list_servers',
    description: 'List all configured SSH servers. Servers can be defined in servers.json or via environment variables.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tag: { type: 'string', description: 'Filter servers by tag (e.g., "prod", "dev")' }
      }
    }
  },
  {
    name: 'ssh_get_server',
    description: 'Get details of a specific configured server by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serverId: { type: 'string', description: 'Server ID to get details for' }
      },
      required: ['serverId']
    }
  },
  {
    name: 'ssh_test_connection',
    description: 'Test SSH/SFTP connection to a configured server without creating a session.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serverId: { type: 'string', description: 'Server ID to test' }
      },
      required: ['serverId']
    }
  },
  {
    name: 'ssh_test_all_connections',
    description: 'Test connections to all configured servers and report status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        parallel: { type: 'boolean', description: 'Test connections in parallel (faster)', default: false }
      }
    }
  },
  {
    name: 'ssh_connect_by_id',
    description: 'Connect to a server using its configuration ID. Credentials are loaded from config.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serverId: { type: 'string', description: 'Server ID from configuration' },
        passwordOverride: { type: 'string', description: 'Override the configured password' }
      },
      required: ['serverId']
    }
  }
];
