import * as fs from 'fs';
import * as path from 'path';
import type { SFTPWrapper, FileEntry, Stats, Attributes } from 'ssh2';
import type { SSHSession, FileInfo, DirectoryListing, FileTransferOptions, TransferResult } from './types.js';

// File mode constants (from stat.h)
const S_IFMT = 0o170000;   // File type mask
const S_IFREG = 0o100000;  // Regular file
const S_IFDIR = 0o040000;  // Directory
const S_IFLNK = 0o120000;  // Symbolic link

/**
 * SFTP file operations
 */
export class SFTPOperations {
  /**
   * Get SFTP client from session
   */
  private static getSFTP(session: SSHSession): SFTPWrapper {
    if (!session.sftp) {
      throw new Error('SFTP client not initialized');
    }
    return session.sftp;
  }

  /**
   * Check if mode indicates a directory
   */
  private static isDirectoryMode(mode: number): boolean {
    return (mode & S_IFMT) === S_IFDIR;
  }

  /**
   * Check if mode indicates a regular file
   */
  private static isFileMode(mode: number): boolean {
    return (mode & S_IFMT) === S_IFREG;
  }

  /**
   * Check if mode indicates a symbolic link
   */
  private static isSymlinkMode(mode: number): boolean {
    return (mode & S_IFMT) === S_IFLNK;
  }

  /**
   * Convert SSH2 stats to FileInfo
   */
  private static statsToFileInfo(filename: string, stats: Stats, longname?: string): FileInfo {
    return {
      filename,
      longname: longname || filename,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymbolicLink: stats.isSymbolicLink(),
      size: stats.size,
      permissions: stats.mode,
      owner: stats.uid,
      group: stats.gid,
      accessTime: new Date(stats.atime * 1000),
      modifyTime: new Date(stats.mtime * 1000)
    };
  }

  /**
   * Convert SSH2 attributes to FileInfo
   */
  private static attrsToFileInfo(filename: string, attrs: Attributes, longname?: string): FileInfo {
    const mode = attrs.mode ?? 0;
    return {
      filename,
      longname: longname || filename,
      isDirectory: this.isDirectoryMode(mode),
      isFile: this.isFileMode(mode),
      isSymbolicLink: this.isSymlinkMode(mode),
      size: attrs.size ?? 0,
      permissions: mode,
      owner: attrs.uid ?? 0,
      group: attrs.gid ?? 0,
      accessTime: new Date((attrs.atime ?? 0) * 1000),
      modifyTime: new Date((attrs.mtime ?? 0) * 1000)
    };
  }

  /**
   * List directory contents
   */
  static async listDirectory(
    session: SSHSession,
    remotePath: string
  ): Promise<DirectoryListing> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(new Error(`Failed to list directory: ${err.message}`));
          return;
        }

        const entries: FileInfo[] = list.map((entry: FileEntry) =>
          this.attrsToFileInfo(entry.filename, entry.attrs, entry.longname)
        );

        session.lastActivity = Date.now();

        resolve({
          path: remotePath,
          entries,
          count: entries.length
        });
      });
    });
  }

  /**
   * Get file/directory stats
   */
  static async stat(session: SSHSession, remotePath: string): Promise<FileInfo> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(new Error(`Failed to get stats: ${err.message}`));
          return;
        }

        session.lastActivity = Date.now();
        resolve(this.statsToFileInfo(path.basename(remotePath), stats));
      });
    });
  }

  /**
   * Check if path exists
   */
  static async exists(session: SSHSession, remotePath: string): Promise<boolean> {
    try {
      await this.stat(session, remotePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory
   */
  static async mkdir(
    session: SSHSession,
    remotePath: string,
    options?: { recursive?: boolean; mode?: number }
  ): Promise<void> {
    const sftp = this.getSFTP(session);
    const recursive = options?.recursive ?? false;
    const mode = options?.mode ?? 0o755;

    if (recursive) {
      await this.mkdirRecursive(session, remotePath, mode);
    } else {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(remotePath, { mode }, (err) => {
          if (err) {
            reject(new Error(`Failed to create directory: ${err.message}`));
            return;
          }
          session.lastActivity = Date.now();
          resolve();
        });
      });
    }
  }

  /**
   * Create directory recursively
   */
  private static async mkdirRecursive(
    session: SSHSession,
    remotePath: string,
    mode: number
  ): Promise<void> {
    const sftp = this.getSFTP(session);
    const parts = remotePath.split('/').filter(Boolean);
    let currentPath = remotePath.startsWith('/') ? '' : '.';

    for (const part of parts) {
      currentPath = currentPath === '.' ? part : `${currentPath}/${part}`;

      try {
        await this.stat(session, currentPath);
      } catch {
        await new Promise<void>((resolve, reject) => {
          sftp.mkdir(currentPath, { mode }, (err) => {
            if (err && err.message !== 'Failure') {
              reject(new Error(`Failed to create directory ${currentPath}: ${err.message}`));
              return;
            }
            resolve();
          });
        });
      }
    }

    session.lastActivity = Date.now();
  }

  /**
   * Remove file
   */
  static async unlink(session: SSHSession, remotePath: string): Promise<void> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) {
          reject(new Error(`Failed to delete file: ${err.message}`));
          return;
        }
        session.lastActivity = Date.now();
        resolve();
      });
    });
  }

  /**
   * Remove directory
   */
  static async rmdir(session: SSHSession, remotePath: string): Promise<void> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) {
          reject(new Error(`Failed to remove directory: ${err.message}`));
          return;
        }
        session.lastActivity = Date.now();
        resolve();
      });
    });
  }

  /**
   * Remove file or directory (recursive)
   */
  static async remove(
    session: SSHSession,
    remotePath: string,
    options?: { recursive?: boolean }
  ): Promise<void> {
    const recursive = options?.recursive ?? false;

    try {
      const stats = await this.stat(session, remotePath);

      if (stats.isDirectory) {
        if (recursive) {
          await this.removeRecursive(session, remotePath);
        } else {
          await this.rmdir(session, remotePath);
        }
      } else {
        await this.unlink(session, remotePath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to remove: ${message}`);
    }
  }

  /**
   * Remove directory recursively
   */
  private static async removeRecursive(
    session: SSHSession,
    remotePath: string
  ): Promise<void> {
    const listing = await this.listDirectory(session, remotePath);

    for (const entry of listing.entries) {
      const entryPath = `${remotePath}/${entry.filename}`;

      if (entry.isDirectory) {
        await this.removeRecursive(session, entryPath);
      } else {
        await this.unlink(session, entryPath);
      }
    }

    await this.rmdir(session, remotePath);
  }

  /**
   * Rename/move file or directory
   */
  static async rename(
    session: SSHSession,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(new Error(`Failed to rename: ${err.message}`));
          return;
        }
        session.lastActivity = Date.now();
        resolve();
      });
    });
  }

  /**
   * Upload file
   */
  static async uploadFile(
    session: SSHSession,
    localPath: string,
    remotePath: string,
    options?: FileTransferOptions
  ): Promise<void> {
    const sftp = this.getSFTP(session);

    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    // Check if remote exists and overwrite is disabled
    if (!options?.overwrite) {
      const exists = await this.exists(session, remotePath);
      if (exists) {
        throw new Error(`Remote file already exists: ${remotePath}`);
      }
    }

    return new Promise((resolve, reject) => {
      const writeOptions: Record<string, number> = {};
      if (options?.permissions) {
        writeOptions.mode = options.permissions;
      }

      sftp.fastPut(localPath, remotePath, writeOptions, (err) => {
        if (err) {
          reject(new Error(`Failed to upload file: ${err.message}`));
          return;
        }
        session.lastActivity = Date.now();
        resolve();
      });
    });
  }

  /**
   * Download file
   */
  static async downloadFile(
    session: SSHSession,
    remotePath: string,
    localPath: string,
    options?: FileTransferOptions
  ): Promise<void> {
    const sftp = this.getSFTP(session);

    // Check if remote file exists
    const exists = await this.exists(session, remotePath);
    if (!exists) {
      throw new Error(`Remote file not found: ${remotePath}`);
    }

    // Check if local exists and overwrite is disabled
    if (!options?.overwrite && fs.existsSync(localPath)) {
      throw new Error(`Local file already exists: ${localPath}`);
    }

    // Ensure local directory exists
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) {
          reject(new Error(`Failed to download file: ${err.message}`));
          return;
        }
        session.lastActivity = Date.now();
        resolve();
      });
    });
  }

  /**
   * Upload directory recursively
   */
  static async uploadDirectory(
    session: SSHSession,
    localPath: string,
    remotePath: string,
    options?: FileTransferOptions
  ): Promise<TransferResult> {
    const result: TransferResult = {
      success: true,
      transferred: [],
      failed: [],
      errors: {}
    };

    // Ensure remote directory exists
    await this.mkdir(session, remotePath, { recursive: true });

    const entries = fs.readdirSync(localPath, { withFileTypes: true });

    for (const entry of entries) {
      const localEntryPath = path.join(localPath, entry.name);
      const remoteEntryPath = `${remotePath}/${entry.name}`;

      try {
        if (entry.isDirectory()) {
          const subResult = await this.uploadDirectory(
            session,
            localEntryPath,
            remoteEntryPath,
            options
          );
          result.transferred.push(...subResult.transferred);
          result.failed.push(...subResult.failed);
          Object.assign(result.errors, subResult.errors);
        } else {
          await this.uploadFile(session, localEntryPath, remoteEntryPath, options);
          result.transferred.push(remoteEntryPath);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed.push(remoteEntryPath);
        result.errors[remoteEntryPath] = message;
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Download directory recursively
   */
  static async downloadDirectory(
    session: SSHSession,
    remotePath: string,
    localPath: string,
    options?: FileTransferOptions
  ): Promise<TransferResult> {
    const result: TransferResult = {
      success: true,
      transferred: [],
      failed: [],
      errors: {}
    };

    // Ensure local directory exists
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    const listing = await this.listDirectory(session, remotePath);

    for (const entry of listing.entries) {
      const remoteEntryPath = `${remotePath}/${entry.filename}`;
      const localEntryPath = path.join(localPath, entry.filename);

      try {
        if (entry.isDirectory) {
          const subResult = await this.downloadDirectory(
            session,
            remoteEntryPath,
            localEntryPath,
            options
          );
          result.transferred.push(...subResult.transferred);
          result.failed.push(...subResult.failed);
          Object.assign(result.errors, subResult.errors);
        } else {
          await this.downloadFile(session, remoteEntryPath, localEntryPath, options);
          result.transferred.push(localEntryPath);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed.push(localEntryPath);
        result.errors[localEntryPath] = message;
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Read file contents
   */
  static async readFile(
    session: SSHSession,
    remotePath: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> {
    const sftp = this.getSFTP(session);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readStream = sftp.createReadStream(remotePath);

      readStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      readStream.on('end', () => {
        session.lastActivity = Date.now();
        resolve(Buffer.concat(chunks).toString(encoding));
      });

      readStream.on('error', (err: Error) => {
        reject(new Error(`Failed to read file: ${err.message}`));
      });
    });
  }

  /**
   * Write file contents
   */
  static async writeFile(
    session: SSHSession,
    remotePath: string,
    content: string | Buffer,
    options?: { encoding?: BufferEncoding; mode?: number }
  ): Promise<void> {
    const sftp = this.getSFTP(session);
    const encoding = options?.encoding || 'utf-8';

    return new Promise((resolve, reject) => {
      const writeOptions: Record<string, unknown> = {};
      if (options?.mode) {
        writeOptions.mode = options.mode;
      }

      const writeStream = sftp.createWriteStream(remotePath, writeOptions);
      const data = typeof content === 'string' ? Buffer.from(content, encoding) : content;

      writeStream.on('close', () => {
        session.lastActivity = Date.now();
        resolve();
      });

      writeStream.on('error', (err: Error) => {
        reject(new Error(`Failed to write file: ${err.message}`));
      });

      writeStream.end(data);
    });
  }
}
