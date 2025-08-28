import { InstallationCommands, ToolDetectionResult } from './types.js';

export class BashToolInstaller {
  private installedTools = new Set<string>();

  detectMissingTool(command: string, stderr: string): ToolDetectionResult {
    const errorText = stderr.toLowerCase();

    // Common missing tool patterns
    const patterns = [
      {
        pattern: /command not found/,
        tools: ['npm', 'bun', 'node', 'python', 'pip', 'git', 'curl', 'wget'],
      },
      { pattern: /npm: command not found/, tool: 'npm' },
      { pattern: /bun: command not found/, tool: 'bun' },
      { pattern: /node: command not found/, tool: 'node' },
      { pattern: /python: command not found/, tool: 'python' },
      { pattern: /pip: command not found/, tool: 'pip' },
      { pattern: /git: command not found/, tool: 'git' },
      { pattern: /curl: command not found/, tool: 'curl' },
      { pattern: /wget: command not found/, tool: 'wget' },
      { pattern: /'([^']+)': command not found/, tool: '$1' },
      { pattern: /"([^"]+)": command not found/, tool: '$1' },
    ];

    for (const { pattern, tools, tool } of patterns) {
      const match = errorText.match(pattern);
      if (match) {
        if (tools) {
          // Check if the command contains any of the tools
          for (const t of tools) {
            if (command.includes(t)) {
              return {
                tool: t,
                shouldInstall: !this.installedTools.has(t),
              };
            }
          }
        } else if (tool) {
          const detectedTool = tool === '$1' ? match[1] : tool;
          return {
            tool: detectedTool,
            shouldInstall: !this.installedTools.has(detectedTool),
          };
        }
      }
    }

    return { tool: null, shouldInstall: false };
  }

  markToolAsInstalled(tool: string): void {
    this.installedTools.add(tool);
  }

  isToolInstalled(tool: string): boolean {
    return this.installedTools.has(tool);
  }

  getInstallationCommands(): InstallationCommands {
    return {
      npm: [
        'curl -L https://www.npmjs.com/install.sh | sh',
        'apt-get update && apt-get install -y npm',
        'yum install -y npm',
      ],
      bun: ['curl -fsSL https://bun.sh/install | bash', 'npm install -g bun'],
      node: [
        'curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt-get install -y nodejs',
        'yum install -y nodejs',
        'brew install node',
      ],
      python: [
        'apt-get update && apt-get install -y python3',
        'yum install -y python3',
        'brew install python',
      ],
      pip: [
        'apt-get update && apt-get install -y python3-pip',
        'yum install -y python3-pip',
        'python3 -m ensurepip --upgrade',
      ],
      git: ['apt-get update && apt-get install -y git', 'yum install -y git', 'brew install git'],
      curl: [
        'apt-get update && apt-get install -y curl',
        'yum install -y curl',
        'brew install curl',
      ],
      wget: [
        'apt-get update && apt-get install -y wget',
        'yum install -y wget',
        'brew install wget',
      ],
    };
  }
}
