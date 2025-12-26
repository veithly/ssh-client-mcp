#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { ConfigManager } from './config/index.js';
import { SessionManager } from './SessionManager.js';
import {
  createConnectionTools,
  connectionToolDefinitions,
  createCommandTools,
  commandToolDefinitions,
  createFileTools,
  fileToolDefinitions,
  createServerTools,
  serverToolDefinitions
} from './tools/index.js';
import type { ServerConfig } from './config/types.js';

/**
 * Parse command line arguments for server configuration
 * Supports: --host, --port, --user/--username, --password, --key, --passphrase, --id, --name
 */
function parseCliArgs(): ServerConfig | null {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return null;
  }

  const server: Partial<ServerConfig> = {
    id: 'cli',
    name: 'CLI Server',
    port: 22
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--host':
      case '-h':
        if (nextArg && !nextArg.startsWith('-')) {
          server.host = nextArg;
          i++;
        }
        break;
      case '--port':
      case '-p':
        if (nextArg && !nextArg.startsWith('-')) {
          server.port = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--user':
      case '--username':
      case '-u':
        if (nextArg && !nextArg.startsWith('-')) {
          server.username = nextArg;
          i++;
        }
        break;
      case '--password':
      case '--pass':
        if (nextArg && !nextArg.startsWith('-')) {
          server.password = nextArg;
          i++;
        }
        break;
      case '--key':
      case '--private-key':
      case '-k':
        if (nextArg && !nextArg.startsWith('-')) {
          server.privateKeyPath = nextArg;
          i++;
        }
        break;
      case '--passphrase':
        if (nextArg && !nextArg.startsWith('-')) {
          server.passphrase = nextArg;
          i++;
        }
        break;
      case '--id':
        if (nextArg && !nextArg.startsWith('-')) {
          server.id = nextArg;
          i++;
        }
        break;
      case '--name':
        if (nextArg && !nextArg.startsWith('-')) {
          server.name = nextArg;
          i++;
        }
        break;
    }
  }

  // Validate required fields
  if (server.host && server.username) {
    return server as ServerConfig;
  }

  return null;
}

// Parse CLI arguments for server config
const cliServer = parseCliArgs();

// Initialize configuration manager (loads from file and env)
const configManager = new ConfigManager(cliServer);
const config = configManager.getConfig();

// Initialize session manager with config values
const sessionManager = new SessionManager(
  config.sessionTimeout,
  config.maxSessions
);

// Initialize tool handlers
const connectionTools = createConnectionTools(sessionManager);
const commandTools = createCommandTools(sessionManager);
const fileTools = createFileTools(sessionManager);
const serverTools = createServerTools(configManager, sessionManager);

// All tool definitions
const allToolDefinitions = [
  ...serverToolDefinitions,      // Server management tools first
  ...connectionToolDefinitions,
  ...commandToolDefinitions,
  ...fileToolDefinitions
];

// Create MCP server
const server = new Server(
  {
    name: 'ssh-client-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allToolDefinitions
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      // Server management tools
      case 'ssh_list_servers':
        result = await serverTools.listServers(args as Parameters<typeof serverTools.listServers>[0]);
        break;
      case 'ssh_get_server':
        result = await serverTools.getServer(args as Parameters<typeof serverTools.getServer>[0]);
        break;
      case 'ssh_test_connection':
        result = await serverTools.testConnection(args as Parameters<typeof serverTools.testConnection>[0]);
        break;
      case 'ssh_test_all_connections':
        result = await serverTools.testAllConnections(args as Parameters<typeof serverTools.testAllConnections>[0]);
        break;
      case 'ssh_connect_by_id':
        result = await serverTools.connectById(args as Parameters<typeof serverTools.connectById>[0]);
        break;

      // Connection tools
      case 'ssh_connect':
        result = await connectionTools.connect(args as Parameters<typeof connectionTools.connect>[0]);
        break;
      case 'ssh_disconnect':
        result = await connectionTools.disconnect(args as Parameters<typeof connectionTools.disconnect>[0]);
        break;
      case 'ssh_list_sessions':
        result = await connectionTools.listSessions();
        break;

      // Command tools
      case 'ssh_exec':
        result = await commandTools.exec(args as Parameters<typeof commandTools.exec>[0]);
        break;
      case 'ssh_sudo_exec':
        result = await commandTools.sudoExec(args as Parameters<typeof commandTools.sudoExec>[0]);
        break;

      // File tools
      case 'sftp_upload':
        result = await fileTools.upload(args as Parameters<typeof fileTools.upload>[0]);
        break;
      case 'sftp_download':
        result = await fileTools.download(args as Parameters<typeof fileTools.download>[0]);
        break;
      case 'sftp_ls':
        result = await fileTools.ls(args as Parameters<typeof fileTools.ls>[0]);
        break;
      case 'sftp_mkdir':
        result = await fileTools.mkdir(args as Parameters<typeof fileTools.mkdir>[0]);
        break;
      case 'sftp_rm':
        result = await fileTools.rm(args as Parameters<typeof fileTools.rm>[0]);
        break;
      case 'sftp_stat':
        result = await fileTools.stat(args as Parameters<typeof fileTools.stat>[0]);
        break;
      case 'sftp_read':
        result = await fileTools.readFile(args as Parameters<typeof fileTools.readFile>[0]);
        break;
      case 'sftp_write':
        result = await fileTools.writeFile(args as Parameters<typeof fileTools.writeFile>[0]);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: message
          })
        }
      ],
      isError: true
    };
  }
});

// Handle graceful shutdown
async function shutdown() {
  console.error('[SSH-MCP] Shutting down...');
  sessionManager.destroy();
  await server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup info
  const servers = configManager.getServers();
  console.error(`[SSH-MCP] Server started (v1.0.0)`);
  console.error(`[SSH-MCP] Loaded ${servers.length} server configurations`);
  if (servers.length > 0) {
    console.error(`[SSH-MCP] Configured servers: ${servers.map(s => s.name).join(', ')}`);
  }
}

main().catch((error) => {
  console.error('[SSH-MCP] Fatal error:', error);
  process.exit(1);
});
