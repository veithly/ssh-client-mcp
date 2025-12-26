import { z } from 'zod';
import type { SessionManager } from '../SessionManager.js';
import { SSHExecutor } from '../SSHExecutor.js';

/**
 * Command tool schemas
 */
export const execSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  command: z.string().describe('Command to execute'),
  timeout: z.number().optional().default(30000).describe('Command timeout in milliseconds')
});

export const sudoExecSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  command: z.string().describe('Command to execute with sudo'),
  sudoPassword: z.string().optional().describe('Sudo password (if required)'),
  timeout: z.number().optional().default(30000).describe('Command timeout in milliseconds')
});

export type ExecInput = z.infer<typeof execSchema>;
export type SudoExecInput = z.infer<typeof sudoExecSchema>;

/**
 * Command tool handlers
 */
export function createCommandTools(sessionManager: SessionManager) {
  return {
    /**
     * Execute a command
     */
    async exec(input: ExecInput): Promise<string> {
      const { sessionId, command, timeout } = input;

      const session = sessionManager.getSession(sessionId);
      const result = await SSHExecutor.executeCommand(session, command, { timeout });

      return JSON.stringify({
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        signal: result.signal
      });
    },

    /**
     * Execute a command with sudo
     */
    async sudoExec(input: SudoExecInput): Promise<string> {
      const { sessionId, command, sudoPassword, timeout } = input;

      const session = sessionManager.getSession(sessionId);
      const result = await SSHExecutor.executeSudoCommand(session, command, {
        sudoPassword,
        timeout
      });

      return JSON.stringify({
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        signal: result.signal
      });
    }
  };
}

/**
 * Command tool definitions for MCP
 */
export const commandToolDefinitions = [
  {
    name: 'ssh_exec',
    description: 'Execute a command on the remote server via SSH. Returns stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID from ssh_connect' },
        command: { type: 'string', description: 'Command to execute on the remote server' },
        timeout: { type: 'number', description: 'Command timeout in milliseconds', default: 30000 }
      },
      required: ['sessionId', 'command']
    }
  },
  {
    name: 'ssh_sudo_exec',
    description: 'Execute a command with sudo privileges on the remote server.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID from ssh_connect' },
        command: { type: 'string', description: 'Command to execute with sudo' },
        sudoPassword: { type: 'string', description: 'Sudo password (if required by server)' },
        timeout: { type: 'number', description: 'Command timeout in milliseconds', default: 30000 }
      },
      required: ['sessionId', 'command']
    }
  }
];
