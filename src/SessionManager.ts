import { Client, SFTPWrapper } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import type { SSHSession, SSHCredentials, SessionInfo } from './types.js';

/**
 * Manages SSH session lifecycle, connection pooling, and auto-cleanup
 */
export class SessionManager {
  private sessions: Map<string, SSHSession> = new Map();
  private sessionTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxSessions: number;

  constructor(sessionTimeout?: number, maxSessions?: number) {
    this.sessionTimeout = sessionTimeout || 30 * 60 * 1000; // 30 minutes default
    this.maxSessions = maxSessions || 100;

    // Start periodic cleanup task
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Create a new SSH session
   */
  async createSession(credentials: SSHCredentials): Promise<string> {
    // Check for existing session with same credentials
    const existingSession = this.findExistingSession(credentials);
    if (existingSession && existingSession.isConnected) {
      existingSession.lastActivity = Date.now();
      return existingSession.id;
    }

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit (${this.maxSessions}) reached. Please close some sessions.`
      );
    }

    const sessionId = uuidv4();
    const client = new Client();

    try {
      const session: SSHSession = {
        id: sessionId,
        credentials,
        client,
        sftp: null,
        isConnected: false,
        lastActivity: Date.now(),
        createdAt: Date.now(),
        commandCount: 0
      };

      // Establish connection
      await this.connectClient(client, credentials);

      // Initialize SFTP
      session.sftp = await this.initSFTP(client);
      session.isConnected = true;

      this.sessions.set(sessionId, session);
      console.error(`[SessionManager] Session created: ${sessionId}`);

      return sessionId;
    } catch (error) {
      client.end();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create SSH session: ${message}`);
    }
  }

  /**
   * Connect SSH client with credentials
   */
  private connectClient(
    client: Client,
    credentials: SSHCredentials
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = credentials.readyTimeout || 30000;

      const timeoutHandle = setTimeout(() => {
        client.end();
        reject(new Error('SSH connection timeout'));
      }, timeout);

      const authConfig: Record<string, unknown> = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
        readyTimeout: timeout,
        algorithms: {
          serverHostKey: [
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'rsa-sha2-512',
            'rsa-sha2-256',
            'ssh-rsa'
          ]
        }
      };

      // Configure authentication method
      if (credentials.privateKey) {
        authConfig.privateKey = this.loadPrivateKey(credentials.privateKey);
        if (credentials.privateKeyPassphrase) {
          authConfig.passphrase = credentials.privateKeyPassphrase;
        }
      } else if (credentials.password) {
        authConfig.password = credentials.password;
      } else {
        clearTimeout(timeoutHandle);
        reject(new Error('No authentication method provided (password or privateKey required)'));
        return;
      }

      client.on('ready', () => {
        clearTimeout(timeoutHandle);
        resolve();
      });

      client.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      client.connect(authConfig);
    });
  }

  /**
   * Load private key from file path or buffer
   */
  private loadPrivateKey(key: string | Buffer): Buffer {
    if (Buffer.isBuffer(key)) {
      return key;
    }

    // Check if it's a file path
    if (fs.existsSync(key)) {
      return fs.readFileSync(key);
    }

    // Treat as key content
    return Buffer.from(key);
  }

  /**
   * Initialize SFTP client
   */
  private initSFTP(client: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          resolve(sftp);
        }
      });
    });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SSHSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.isConnected) {
      throw new Error(`Session is not connected: ${sessionId}`);
    }

    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): SessionInfo {
    const session = this.getSession(sessionId);
    return {
      sessionId: session.id,
      host: session.credentials.host,
      username: session.credentials.username,
      isConnected: session.isConnected,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      commandCount: session.commandCount,
      uptime: Date.now() - session.createdAt
    };
  }

  /**
   * List all active sessions
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.isConnected)
      .map((s) => ({
        sessionId: s.id,
        host: s.credentials.host,
        username: s.credentials.username,
        isConnected: s.isConnected,
        lastActivity: s.lastActivity,
        createdAt: s.createdAt,
        commandCount: s.commandCount,
        uptime: Date.now() - s.createdAt
      }));
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      if (session.sftp) {
        session.sftp.end();
      }

      session.client.end();
      session.isConnected = false;
      this.sessions.delete(sessionId);
      console.error(`[SessionManager] Session closed: ${sessionId}`);
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.closeSession(sessionId).catch((err) => {
        console.error(`Error cleaning up session ${sessionId}:`, err);
      });
    }

    if (expiredSessions.length > 0) {
      console.error(
        `[SessionManager] Cleaned up ${expiredSessions.length} expired sessions`
      );
    }
  }

  /**
   * Find existing session with same credentials
   */
  private findExistingSession(credentials: SSHCredentials): SSHSession | null {
    for (const session of this.sessions.values()) {
      if (
        session.credentials.host === credentials.host &&
        session.credentials.port === (credentials.port || 22) &&
        session.credentials.username === credentials.username
      ) {
        return session;
      }
    }
    return null;
  }

  /**
   * Destroy manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.closeAllSessions();
  }
}
