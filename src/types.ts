import type { Client, SFTPWrapper } from 'ssh2';

/**
 * SSH connection credentials
 */
export interface SSHCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  privateKeyPassphrase?: string;
  readyTimeout?: number;
  connectionTimeout?: number;
}

/**
 * SSH session with connection state
 */
export interface SSHSession {
  id: string;
  credentials: SSHCredentials;
  client: Client;
  sftp: SFTPWrapper | null;
  isConnected: boolean;
  lastActivity: number;
  createdAt: number;
  commandCount: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

/**
 * File transfer options
 */
export interface FileTransferOptions {
  recursive?: boolean;
  overwrite?: boolean;
  permissions?: number;
}

/**
 * File transfer result
 */
export interface TransferResult {
  success: boolean;
  transferred: string[];
  failed: string[];
  errors: Record<string, string>;
}

/**
 * Session information for listing
 */
export interface SessionInfo {
  sessionId: string;
  host: string;
  username: string;
  isConnected: boolean;
  lastActivity: number;
  createdAt: number;
  commandCount: number;
  uptime: number;
}

/**
 * Session connection status
 */
export enum SessionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

/**
 * File information from SFTP
 */
export interface FileInfo {
  filename: string;
  longname: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
  size: number;
  permissions: number;
  owner: number;
  group: number;
  accessTime: Date;
  modifyTime: Date;
}

/**
 * Directory listing result
 */
export interface DirectoryListing {
  path: string;
  entries: FileInfo[];
  count: number;
}

/**
 * Command execution options
 */
export interface CommandOptions {
  timeout?: number;
  encoding?: BufferEncoding;
}

/**
 * Sudo command options
 */
export interface SudoCommandOptions extends CommandOptions {
  sudoPassword?: string;
}
