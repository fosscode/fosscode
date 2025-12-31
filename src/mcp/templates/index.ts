import { MCPServerTemplate } from '../types.js';

/**
 * Built-in MCP server templates for common use cases
 */
export const serverTemplates: MCPServerTemplate[] = [
  // Filesystem Templates
  {
    id: 'filesystem-local',
    name: 'Local Filesystem',
    description: 'Access and manage local filesystem with read, write, and search capabilities',
    category: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    documentation: `
# Local Filesystem MCP Server

Provides tools for interacting with the local filesystem.

## Tools Available
- read_file: Read contents of a file
- read_multiple_files: Read multiple files at once
- write_file: Write content to a file
- edit_file: Make line-based edits to a file
- create_directory: Create a new directory
- list_directory: List directory contents
- directory_tree: Get a recursive tree view
- move_file: Move or rename files/directories
- search_files: Search for files by pattern
- get_file_info: Get file metadata

## Usage Notes
- Paths are relative to the allowed directories
- Use absolute paths when possible
- Be careful with write operations
    `,
    permissions: ['mcp__filesystem-local__*'],
  },
  {
    id: 'filesystem-restricted',
    name: 'Restricted Filesystem',
    description: 'Filesystem access limited to specific directories',
    category: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    requiredEnvVars: ['MCP_ALLOWED_DIRS'],
    documentation: `
# Restricted Filesystem MCP Server

Same as Local Filesystem but restricted to specific directories.

## Configuration
Set MCP_ALLOWED_DIRS environment variable with comma-separated paths.

Example: MCP_ALLOWED_DIRS=/home/user/projects,/tmp
    `,
    permissions: [
      'mcp__filesystem-restricted__read_file',
      'mcp__filesystem-restricted__list_directory',
      'mcp__filesystem-restricted__search_files',
    ],
  },

  // Git Templates
  {
    id: 'git',
    name: 'Git Repository',
    description: 'Git operations including status, commits, branches, and diffs',
    category: 'git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    documentation: `
# Git MCP Server

Provides tools for Git repository operations.

## Tools Available
- git_status: Show working tree status
- git_diff: Show changes in files
- git_commit: Create a new commit
- git_add: Stage files for commit
- git_reset: Unstage files
- git_log: Show commit history
- git_branch: List, create, or delete branches
- git_checkout: Switch branches or restore files
- git_merge: Join development histories
- git_stash: Stash changes
- git_clone: Clone a repository
- git_pull: Fetch and merge from remote
- git_push: Push to remote repository

## Usage Notes
- Operates on the current working directory
- Some operations require clean working tree
    `,
    permissions: ['mcp__git__*'],
  },
  {
    id: 'github',
    name: 'GitHub API',
    description: 'GitHub API access for repos, issues, PRs, and more',
    category: 'git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    requiredEnvVars: ['GITHUB_TOKEN'],
    documentation: `
# GitHub MCP Server

Provides tools for GitHub API operations.

## Tools Available
- create_or_update_file: Create or update a file in a repository
- search_repositories: Search GitHub repositories
- create_repository: Create a new repository
- get_file_contents: Get file contents from a repository
- push_files: Push multiple files to a repository
- create_issue: Create a new issue
- create_pull_request: Create a new pull request
- fork_repository: Fork a repository
- create_branch: Create a new branch
- list_commits: List commits in a repository
- list_issues: List issues in a repository

## Configuration
Requires GITHUB_TOKEN environment variable with appropriate scopes.
    `,
    permissions: ['mcp__github__*'],
  },

  // Database Templates
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'Query and manage SQLite databases',
    category: 'database',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
    requiredEnvVars: ['SQLITE_DB_PATH'],
    documentation: `
# SQLite MCP Server

Provides tools for SQLite database operations.

## Tools Available
- read_query: Execute a SELECT query
- write_query: Execute INSERT, UPDATE, or DELETE
- create_table: Create a new table
- list_tables: List all tables
- describe_table: Get table schema
- append_insight: Store analysis insights

## Configuration
Set SQLITE_DB_PATH to the database file path.
    `,
    permissions: ['mcp__sqlite__*'],
  },
  {
    id: 'postgres',
    name: 'PostgreSQL Database',
    description: 'Connect to and query PostgreSQL databases',
    category: 'database',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    requiredEnvVars: ['POSTGRES_URL'],
    documentation: `
# PostgreSQL MCP Server

Provides tools for PostgreSQL database operations.

## Tools Available
- query: Execute SQL queries
- list_tables: List all tables in the database
- describe_table: Get table schema and constraints

## Configuration
Set POSTGRES_URL to your PostgreSQL connection string.
Example: postgres://user:pass@localhost:5432/dbname
    `,
    permissions: ['mcp__postgres__*'],
  },

  // API Templates
  {
    id: 'fetch',
    name: 'Web Fetch',
    description: 'Fetch and parse web content',
    category: 'api',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    documentation: `
# Fetch MCP Server

Provides tools for fetching web content.

## Tools Available
- fetch: Fetch a URL and return content
- fetch_html: Fetch and parse HTML content
- fetch_json: Fetch and parse JSON content

## Usage Notes
- Respects robots.txt by default
- Supports various content types
    `,
    permissions: ['mcp__fetch__*'],
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search using Brave Search API',
    category: 'api',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    requiredEnvVars: ['BRAVE_API_KEY'],
    documentation: `
# Brave Search MCP Server

Provides web search capabilities using Brave Search API.

## Tools Available
- brave_web_search: Search the web
- brave_local_search: Search for local businesses

## Configuration
Set BRAVE_API_KEY to your Brave Search API key.
Get one at: https://brave.com/search/api/
    `,
    permissions: ['mcp__brave-search__*'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Interact with Slack workspaces',
    category: 'api',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    requiredEnvVars: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    documentation: `
# Slack MCP Server

Provides tools for Slack workspace interaction.

## Tools Available
- list_channels: List available channels
- post_message: Post a message to a channel
- reply_to_thread: Reply to a message thread
- add_reaction: Add an emoji reaction
- get_channel_history: Get recent messages
- get_thread_replies: Get replies in a thread
- search_messages: Search for messages
- get_users: List workspace users
- get_user_profile: Get user details

## Configuration
Requires SLACK_BOT_TOKEN and SLACK_TEAM_ID.
    `,
    permissions: ['mcp__slack__*'],
  },

  // Utility Templates
  {
    id: 'time',
    name: 'Time & Timezone',
    description: 'Time operations and timezone conversions',
    category: 'utility',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-time'],
    documentation: `
# Time MCP Server

Provides tools for time and timezone operations.

## Tools Available
- get_current_time: Get current time in a timezone
- convert_time: Convert time between timezones
- get_timezone_offset: Get timezone offset information
    `,
    permissions: ['mcp__time__*'],
  },
  {
    id: 'memory',
    name: 'Knowledge Graph Memory',
    description: 'Persistent memory using a knowledge graph',
    category: 'utility',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    documentation: `
# Memory MCP Server

Provides persistent memory storage using a knowledge graph.

## Tools Available
- create_entities: Create new entities in the graph
- create_relations: Create relationships between entities
- add_observations: Add observations about entities
- delete_entities: Remove entities
- delete_observations: Remove observations
- delete_relations: Remove relationships
- read_graph: Read the entire knowledge graph
- search_nodes: Search for specific nodes
- open_nodes: Get details about specific entities

## Usage Notes
- Data persists across sessions
- Useful for maintaining context over time
    `,
    permissions: ['mcp__memory__*'],
  },
  {
    id: 'puppeteer',
    name: 'Browser Automation',
    description: 'Control a headless browser for web automation',
    category: 'utility',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    documentation: `
# Puppeteer MCP Server

Provides browser automation using Puppeteer.

## Tools Available
- puppeteer_navigate: Navigate to a URL
- puppeteer_screenshot: Take a screenshot
- puppeteer_click: Click an element
- puppeteer_fill: Fill in a form field
- puppeteer_select: Select from a dropdown
- puppeteer_hover: Hover over an element
- puppeteer_evaluate: Execute JavaScript

## Usage Notes
- Runs a headless Chrome browser
- Screenshots are returned as base64
    `,
    permissions: ['mcp__puppeteer__*'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Dynamic problem-solving through thought sequences',
    category: 'utility',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    documentation: `
# Sequential Thinking MCP Server

Provides structured thinking and problem decomposition.

## Tools Available
- sequentialthinking: Process thoughts in sequence

## Usage Notes
- Helps with complex problem decomposition
- Maintains thinking context across steps
    `,
    permissions: ['mcp__sequential-thinking__*'],
  },
];

/**
 * Get all available templates
 */
export function getAllTemplates(): MCPServerTemplate[] {
  return serverTemplates;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: MCPServerTemplate['category']
): MCPServerTemplate[] {
  return serverTemplates.filter((t) => t.category === category);
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): MCPServerTemplate | undefined {
  return serverTemplates.find((t) => t.id === id);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): MCPServerTemplate[] {
  const lowerQuery = query.toLowerCase();
  return serverTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.id.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): MCPServerTemplate['category'][] {
  return ['filesystem', 'git', 'database', 'api', 'utility', 'custom'];
}

/**
 * Validate environment variables for a template
 */
export function validateTemplateEnvVars(
  template: MCPServerTemplate
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (template.requiredEnvVars) {
    for (const envVar of template.requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
