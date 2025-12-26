import { Client } from 'ssh2';
import * as fs from 'fs';
import type { ServerConfig, ConnectionStatus } from './config/types.js';

/**
 * Tests SSH/SFTP connections to remote servers
 */
export class ConnectionTester {
  private timeout: number;

  constructor(timeout: number = 15000) {
    this.timeout = timeout;
  }

  /**
   * Test connection to a single server
   */
  async testConnection(server: ServerConfig): Promise<ConnectionStatus> {
    const startTime = Date.now();

    const status: ConnectionStatus = {
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      connected: false,
      lastChecked: new Date(),
      capabilities: {
        ssh: false,
        sftp: false
      }
    };

    return new Promise((resolve) => {
      const client = new Client();
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          client.end();
          resolve(status);
        }
      };

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          status.error = 'Connection timeout';
          finish();
        }
      }, this.timeout);

      const connectionConfig: Record<string, unknown> = {
        host: server.host,
        port: server.port || 22,
        username: server.username,
        readyTimeout: this.timeout
      };

      // Configure authentication
      if (server.privateKeyPath) {
        try {
          connectionConfig.privateKey = fs.readFileSync(server.privateKeyPath);
          if (server.passphrase) {
            connectionConfig.passphrase = server.passphrase;
          }
        } catch (error) {
          clearTimeout(timeoutHandle);
          status.error = `Cannot read private key: ${error instanceof Error ? error.message : error}`;
          return resolve(status);
        }
      } else if (server.password) {
        connectionConfig.password = server.password;
      } else {
        clearTimeout(timeoutHandle);
        status.error = 'No password or private key provided';
        return resolve(status);
      }

      client
        .on('ready', () => {
          clearTimeout(timeoutHandle);
          status.connected = true;
          status.capabilities.ssh = true;
          status.latencyMs = Date.now() - startTime;

          // Test SFTP capability
          client.sftp((err, sftp) => {
            if (!err && sftp) {
              status.capabilities.sftp = true;
              sftp.end();
            }
            finish();
          });
        })
        .on('error', (err: Error) => {
          clearTimeout(timeoutHandle);
          status.error = err.message;
          finish();
        })
        .on('timeout', () => {
          clearTimeout(timeoutHandle);
          status.error = 'Connection timeout';
          finish();
        })
        .connect(connectionConfig);
    });
  }

  /**
   * Test connections to multiple servers
   */
  async testAllConnections(servers: ServerConfig[]): Promise<ConnectionStatus[]> {
    const results: ConnectionStatus[] = [];

    for (const server of servers) {
      console.error(`[ConnectionTester] Testing: ${server.name} (${server.host})`);
      const status = await this.testConnection(server);
      results.push(status);

      const statusIcon = status.connected ? '✓' : '✗';
      const latency = status.latencyMs ? ` (${status.latencyMs}ms)` : '';
      console.error(`[ConnectionTester] ${statusIcon} ${server.name}${latency}${status.error ? ` - ${status.error}` : ''}`);
    }

    return results;
  }

  /**
   * Test connections in parallel (faster but may overload network)
   */
  async testAllConnectionsParallel(servers: ServerConfig[]): Promise<ConnectionStatus[]> {
    const promises = servers.map(server => this.testConnection(server));
    return Promise.all(promises);
  }

  /**
   * Quick ping test (just checks if port is reachable)
   */
  async pingServer(host: string, port: number = 22): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ reachable: false, error: 'Connection timeout' });
      }, 5000);

      socket.connect(port, host, () => {
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ reachable: false, error: err.message });
      });
    });
  }
}
