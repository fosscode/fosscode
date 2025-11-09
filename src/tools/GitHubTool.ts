import { execSync } from 'child_process';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';

export class GitHubTool implements Tool {
  name = 'github';
  description = 'Interact with GitHub repositories, issues, and pull requests using the GitHub CLI';

  parameters: ToolParameter[] = [
    {
      name: 'operation',
      type: 'string',
      description:
        'GitHub operation to perform (list-issues, create-issue, list-prs, create-pr, view-issue, view-pr)',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: 'Repository in format owner/repo (defaults to current repo if in git directory)',
      required: false,
    },
    {
      name: 'title',
      type: 'string',
      description: 'Title for issue or PR creation',
      required: false,
    },
    {
      name: 'body',
      type: 'string',
      description: 'Body/description for issue or PR',
      required: false,
    },
    {
      name: 'number',
      type: 'number',
      description: 'Issue or PR number for viewing',
      required: false,
    },
    {
      name: 'state',
      type: 'string',
      description: 'State filter (open, closed, all) for listing',
      required: false,
      defaultValue: 'open',
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of items to return',
      required: false,
      defaultValue: 10,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { operation, repo, title, body, number, state = 'open', limit = 10 } = params;

      const command = 'gh';
      let args: string[] = [];

      switch (operation) {
        case 'list-issues':
          args = ['issue', 'list', '--state', state, '--limit', limit.toString()];
          if (repo) args.push('--repo', repo);
          break;
        case 'create-issue':
          if (!title) throw new Error('Title required for creating issue');
          args = ['issue', 'create', '--title', title];
          if (body) args.push('--body', body);
          if (repo) args.push('--repo', repo);
          break;
        case 'view-issue':
          if (!number) throw new Error('Issue number required for viewing');
          args = ['issue', 'view', number.toString()];
          if (repo) args.push('--repo', repo);
          break;
        case 'list-prs':
          args = ['pr', 'list', '--state', state, '--limit', limit.toString()];
          if (repo) args.push('--repo', repo);
          break;
        case 'create-pr':
          if (!title) throw new Error('Title required for creating PR');
          args = ['pr', 'create', '--title', title];
          if (body) args.push('--body', body);
          if (repo) args.push('--repo', repo);
          break;
        case 'view-pr':
          if (!number) throw new Error('PR number required for viewing');
          args = ['pr', 'view', number.toString()];
          if (repo) args.push('--repo', repo);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const fullCommand = [command, ...args].join(' ');
      const output = execSync(fullCommand, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      return {
        success: true,
        data: {
          operation,
          output: output.trim(),
          command: fullCommand,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'GitHub operation failed',
      };
    }
  }
}
