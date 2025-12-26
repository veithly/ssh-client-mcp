import type { SSHSession, CommandResult, CommandOptions, SudoCommandOptions } from './types.js';

/**
 * Executes SSH commands on remote servers
 */
export class SSHExecutor {
  /**
   * Execute a remote command
   */
  static async executeCommand(
    session: SSHSession,
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    const timeout = options?.timeout || 30000;
    const encoding = options?.encoding || 'utf-8';

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let signal: string | null = null;

      session.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutHandle);
          reject(err);
          return;
        }

        stream.on('close', (code: number, sig: string) => {
          clearTimeout(timeoutHandle);
          exitCode = code;
          signal = sig;

          session.commandCount++;
          session.lastActivity = Date.now();

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
            signal
          });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString(encoding);
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString(encoding);
        });

        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeoutHandle);
          reject(streamErr);
        });
      });
    });
  }

  /**
   * Execute multiple commands sequentially
   */
  static async executeCommands(
    session: SSHSession,
    commands: string[],
    options?: CommandOptions & { stopOnError?: boolean }
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const stopOnError = options?.stopOnError ?? false;

    for (const command of commands) {
      try {
        const result = await this.executeCommand(session, command, options);
        results.push(result);

        if (stopOnError && result.exitCode !== 0) {
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          stdout: '',
          stderr: message,
          exitCode: -1,
          signal: null
        });

        if (stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a command with sudo
   */
  static async executeSudoCommand(
    session: SSHSession,
    command: string,
    options?: SudoCommandOptions
  ): Promise<CommandResult> {
    const timeout = options?.timeout || 30000;
    const encoding = options?.encoding || 'utf-8';
    const sudoPassword = options?.sudoPassword;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Sudo command execution timeout after ${timeout}ms`));
      }, timeout);

      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let signal: string | null = null;
      let passwordSent = false;

      // Use -S flag to read password from stdin
      const sudoCommand = sudoPassword
        ? `echo '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S ${command}`
        : `sudo ${command}`;

      session.client.exec(sudoCommand, { pty: !!sudoPassword }, (err, stream) => {
        if (err) {
          clearTimeout(timeoutHandle);
          reject(err);
          return;
        }

        stream.on('close', (code: number, sig: string) => {
          clearTimeout(timeoutHandle);
          exitCode = code;
          signal = sig;

          session.commandCount++;
          session.lastActivity = Date.now();

          // Remove password prompt from output if present
          const cleanStderr = stderr
            .replace(/\[sudo\] password for .+?:/g, '')
            .replace(/Password:/g, '')
            .trim();

          resolve({
            stdout: stdout.trim(),
            stderr: cleanStderr,
            exitCode,
            signal
          });
        });

        stream.on('data', (data: Buffer) => {
          const text = data.toString(encoding);

          // Check for password prompt and send password
          if (!passwordSent && sudoPassword &&
              (text.includes('password') || text.includes('Password'))) {
            stream.write(sudoPassword + '\n');
            passwordSent = true;
          } else {
            stdout += text;
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString(encoding);
        });

        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeoutHandle);
          reject(streamErr);
        });
      });
    });
  }

  /**
   * Execute an interactive command with input
   */
  static async executeWithInput(
    session: SSHSession,
    command: string,
    input: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    const timeout = options?.timeout || 30000;
    const encoding = options?.encoding || 'utf-8';

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      let signal: string | null = null;

      session.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutHandle);
          reject(err);
          return;
        }

        // Send input
        stream.write(input);
        stream.end();

        stream.on('close', (code: number, sig: string) => {
          clearTimeout(timeoutHandle);
          exitCode = code;
          signal = sig;

          session.commandCount++;
          session.lastActivity = Date.now();

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
            signal
          });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString(encoding);
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString(encoding);
        });

        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeoutHandle);
          reject(streamErr);
        });
      });
    });
  }
}
