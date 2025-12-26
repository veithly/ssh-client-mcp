import { z } from 'zod';
import type { SessionManager } from '../SessionManager.js';

/**
 * Connection tool schemas
 */
export const connectSchema = z.object({
  host: z.string().describe('SSH server hostname or IP address'),
  port: z.number().optional().default(22).describe('SSH server port (default: 22)'),
  username: z.string().describe('SSH username'),
  password: z.string().optional().describe('SSH password (for password auth)'),
  privateKey: z.string().optional().describe('Private key content or file path (for key auth)'),
  privateKeyPassphrase: z.string().optional().describe('Passphrase for encrypted private key'),
  timeout: z.number().optional().default(30000).describe('Connection timeout in milliseconds')
});

export const disconnectSchema = z.object({
  sessionId: z.string().describe('Session ID to disconnect')
});

export const listSessionsSchema = z.object({});

export type ConnectInput = z.infer<typeof connectSchema>;
export type DisconnectInput = z.infer<typeof disconnectSchema>;

/**
 * Connection tool handlers
 */
export function createConnectionTools(sessionManager: SessionManager) {
  return {
    /**
     * Connect to SSH server
     */
    async connect(input: ConnectInput): Promise<string> {
      const { host, port, username, password, privateKey, privateKeyPassphrase, timeout } = input;

      if (!password && !privateKey) {
        throw new Error('Either password or privateKey must be provided');
      }

      const sessionId = await sessionManager.createSession({
        host,
        port,
        username,
        password,
        privateKey,
        privateKeyPassphrase,
        readyTimeout: timeout
      });

      return JSON.stringify({
        success: true,
        sessionId,
        message: `Connected to ${username}@${host}:${port}`
      });
    },

    /**
     * Disconnect from SSH server
     */
    async disconnect(input: DisconnectInput): Promise<string> {
      const { sessionId } = input;

      await sessionManager.closeSession(sessionId);

      return JSON.stringify({
        success: true,
        message: `Session ${sessionId} disconnected`
      });
    },

    /**
     * List active sessions
     */
    async listSessions(): Promise<string> {
      const sessions = sessionManager.listSessions();

      return JSON.stringify({
        success: true,
        count: sessions.length,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          host: s.host,
          username: s.username,
          uptime: `${Math.round(s.uptime / 1000)}s`,
          commandCount: s.commandCount,
          lastActivity: new Date(s.lastActivity).toISOString()
        }))
      });
    }
  };
}

/**
 * Connection tool definitions for MCP
 */
export const connectionToolDefinitions = [
  {
    name: 'ssh_connect',
    description: 'Establish an SSH connection to a remote server. Returns a session ID for subsequent operations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        host: { type: 'string', description: 'SSH server hostname or IP address' },
        port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
        username: { type: 'string', description: 'SSH username' },
        password: { type: 'string', description: 'SSH password (for password authentication)' },
        privateKey: { type: 'string', description: 'Private key content or file path (for key authentication)' },
        privateKeyPassphrase: { type: 'string', description: 'Passphrase for encrypted private key' },
        timeout: { type: 'number', description: 'Connection timeout in milliseconds', default: 30000 }
      },
      required: ['host', 'username']
    }
  },
  {
    name: 'ssh_disconnect',
    description: 'Close an SSH session and release resources.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'Session ID to disconnect' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'ssh_list_sessions',
    description: 'List all active SSH sessions with their status and statistics.',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    }
  }
];
