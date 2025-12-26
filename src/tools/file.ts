import { z } from 'zod';
import type { SessionManager } from '../SessionManager.js';
import { SFTPOperations } from '../SFTPOperations.js';

/**
 * File tool schemas
 */
export const uploadSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  localPath: z.string().describe('Local file path to upload'),
  remotePath: z.string().describe('Remote destination path'),
  overwrite: z.boolean().optional().default(false).describe('Overwrite if file exists')
});

export const downloadSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  remotePath: z.string().describe('Remote file path to download'),
  localPath: z.string().describe('Local destination path'),
  overwrite: z.boolean().optional().default(false).describe('Overwrite if file exists')
});

export const lsSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote directory path to list')
});

export const mkdirSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote directory path to create'),
  recursive: z.boolean().optional().default(false).describe('Create parent directories if needed')
});

export const rmSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote path to delete'),
  recursive: z.boolean().optional().default(false).describe('Delete directories recursively')
});

export const statSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote path to get info')
});

export const readFileSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote file path to read'),
  encoding: z.string().optional().default('utf-8').describe('File encoding')
});

export const writeFileSchema = z.object({
  sessionId: z.string().describe('SSH session ID'),
  path: z.string().describe('Remote file path to write'),
  content: z.string().describe('File content to write'),
  encoding: z.string().optional().default('utf-8').describe('File encoding')
});

export type UploadInput = z.infer<typeof uploadSchema>;
export type DownloadInput = z.infer<typeof downloadSchema>;
export type LsInput = z.infer<typeof lsSchema>;
export type MkdirInput = z.infer<typeof mkdirSchema>;
export type RmInput = z.infer<typeof rmSchema>;
export type StatInput = z.infer<typeof statSchema>;
export type ReadFileInput = z.infer<typeof readFileSchema>;
export type WriteFileInput = z.infer<typeof writeFileSchema>;

/**
 * File tool handlers
 */
export function createFileTools(sessionManager: SessionManager) {
  return {
    /**
     * Upload file
     */
    async upload(input: UploadInput): Promise<string> {
      const { sessionId, localPath, remotePath, overwrite } = input;

      const session = sessionManager.getSession(sessionId);
      await SFTPOperations.uploadFile(session, localPath, remotePath, { overwrite });

      return JSON.stringify({
        success: true,
        message: `Uploaded ${localPath} to ${remotePath}`
      });
    },

    /**
     * Download file
     */
    async download(input: DownloadInput): Promise<string> {
      const { sessionId, remotePath, localPath, overwrite } = input;

      const session = sessionManager.getSession(sessionId);
      await SFTPOperations.downloadFile(session, remotePath, localPath, { overwrite });

      return JSON.stringify({
        success: true,
        message: `Downloaded ${remotePath} to ${localPath}`
      });
    },

    /**
     * List directory
     */
    async ls(input: LsInput): Promise<string> {
      const { sessionId, path } = input;

      const session = sessionManager.getSession(sessionId);
      const listing = await SFTPOperations.listDirectory(session, path);

      return JSON.stringify({
        success: true,
        path: listing.path,
        count: listing.count,
        entries: listing.entries.map(e => ({
          name: e.filename,
          type: e.isDirectory ? 'directory' : e.isSymbolicLink ? 'symlink' : 'file',
          size: e.size,
          permissions: e.permissions.toString(8),
          modified: e.modifyTime.toISOString()
        }))
      });
    },

    /**
     * Create directory
     */
    async mkdir(input: MkdirInput): Promise<string> {
      const { sessionId, path, recursive } = input;

      const session = sessionManager.getSession(sessionId);
      await SFTPOperations.mkdir(session, path, { recursive });

      return JSON.stringify({
        success: true,
        message: `Created directory ${path}`
      });
    },

    /**
     * Remove file or directory
     */
    async rm(input: RmInput): Promise<string> {
      const { sessionId, path, recursive } = input;

      const session = sessionManager.getSession(sessionId);
      await SFTPOperations.remove(session, path, { recursive });

      return JSON.stringify({
        success: true,
        message: `Removed ${path}`
      });
    },

    /**
     * Get file/directory info
     */
    async stat(input: StatInput): Promise<string> {
      const { sessionId, path } = input;

      const session = sessionManager.getSession(sessionId);
      const info = await SFTPOperations.stat(session, path);

      return JSON.stringify({
        success: true,
        path,
        type: info.isDirectory ? 'directory' : info.isSymbolicLink ? 'symlink' : 'file',
        size: info.size,
        permissions: info.permissions.toString(8),
        owner: info.owner,
        group: info.group,
        accessTime: info.accessTime.toISOString(),
        modifyTime: info.modifyTime.toISOString()
      });
    },

    /**
     * Read file contents
     */
    async readFile(input: ReadFileInput): Promise<string> {
      const { sessionId, path, encoding } = input;

      const session = sessionManager.getSession(sessionId);
      const content = await SFTPOperations.readFile(session, path, encoding as BufferEncoding);

      return JSON.stringify({
        success: true,
        path,
        content,
        size: content.length
      });
    },

    /**
     * Write file contents
     */
    async writeFile(input: WriteFileInput): Promise<string> {
      const { sessionId, path, content, encoding } = input;

      const session = sessionManager.getSession(sessionId);
      await SFTPOperations.writeFile(session, path, content, { encoding: encoding as BufferEncoding });

      return JSON.stringify({
        success: true,
        path,
        message: `Wrote ${content.length} bytes to ${path}`
      });
    }
  };
}

/**
 * File tool definitions for MCP
 */
export const fileToolDefinitions = [
  {
    name: 'sftp_upload',
    description: 'Upload a local file to the remote server via SFTP.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        localPath: { type: 'string', description: 'Local file path to upload' },
        remotePath: { type: 'string', description: 'Remote destination path' },
        overwrite: { type: 'boolean', description: 'Overwrite if exists', default: false }
      },
      required: ['sessionId', 'localPath', 'remotePath']
    }
  },
  {
    name: 'sftp_download',
    description: 'Download a file from the remote server to local via SFTP.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        remotePath: { type: 'string', description: 'Remote file path to download' },
        localPath: { type: 'string', description: 'Local destination path' },
        overwrite: { type: 'boolean', description: 'Overwrite if exists', default: false }
      },
      required: ['sessionId', 'remotePath', 'localPath']
    }
  },
  {
    name: 'sftp_ls',
    description: 'List contents of a remote directory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote directory path' }
      },
      required: ['sessionId', 'path']
    }
  },
  {
    name: 'sftp_mkdir',
    description: 'Create a directory on the remote server.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote directory path to create' },
        recursive: { type: 'boolean', description: 'Create parent directories', default: false }
      },
      required: ['sessionId', 'path']
    }
  },
  {
    name: 'sftp_rm',
    description: 'Remove a file or directory on the remote server.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote path to delete' },
        recursive: { type: 'boolean', description: 'Delete directories recursively', default: false }
      },
      required: ['sessionId', 'path']
    }
  },
  {
    name: 'sftp_stat',
    description: 'Get file or directory information (size, permissions, timestamps).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote path' }
      },
      required: ['sessionId', 'path']
    }
  },
  {
    name: 'sftp_read',
    description: 'Read contents of a remote file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote file path' },
        encoding: { type: 'string', description: 'File encoding', default: 'utf-8' }
      },
      required: ['sessionId', 'path']
    }
  },
  {
    name: 'sftp_write',
    description: 'Write content to a remote file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string', description: 'SSH session ID' },
        path: { type: 'string', description: 'Remote file path' },
        content: { type: 'string', description: 'Content to write' },
        encoding: { type: 'string', description: 'File encoding', default: 'utf-8' }
      },
      required: ['sessionId', 'path', 'content']
    }
  }
];
