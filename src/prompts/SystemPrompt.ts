import * as path from 'path';
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as os from 'os';
import * as fs from 'fs';
import { listAvailableTools } from '../tools/init.js';
import { fileTrackerManager } from '../utils/FileTrackerManager.js';
import { PromptHistoryManager } from '../utils/PromptHistoryManager.js';
import { Message } from '../types/index.js';

// Base system prompt for fosscode - CLI tool behavior
export const BASE_SYSTEM_PROMPT = `You are an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming. You may use URLs provided by the user in their messages or local files.

If the user asks for help or wants to give feedback inform them of the following:
- /help: Get help with using fosscode
- To give feedback, users should report the issue at https://github.com/fosscode/fosscode/issues

# Tone and style
You should be concise, direct, and to the point.
You MUST answer concisely with fewer than 4 lines (not including tool use or code generation), unless user asks for detail.
IMPORTANT: You should minimize output tokens as much as possible while maintaining helpfulness, quality, and accuracy. Only address the specific query or task at hand, avoiding tangential information unless absolutely critical for completing the request. If you can answer in 1-3 sentences or a short paragraph, please do.
IMPORTANT: You should NOT answer with unnecessary preamble or postamble (such as explaining your code or summarizing your action), unless the user asks you to.
Do not add additional code explanation summary unless requested by the user. After working on a file, just stop, rather than providing an explanation of what you did.
Answer the user's question directly, without elaboration, explanation, or details. One word answers are best. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>.", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...".

When using tools, you can be more verbose to explain what you're doing and why. For complex tasks, use the TodoWrite tool first to plan your approach.

Here are some examples to demonstrate appropriate verbosity:

<example>
user: 2 + 2
assistant: 4
</example>

<example>
user: what is 2+2?
assistant: 4
</example>

<example>
user: is 11 a prime number?
assistant: Yes
</example>

<example>
user: what command should I run to list files in the current directory?
assistant: ls
</example>

<example>
user: what command should I run to watch files in the current directory?
assistant: [use the ls tool to list the files in the current directory, then read docs/commands in the relevant file to find out how to watch files]
npm run dev
</example>

<example>
user: How many golf balls fit inside a jetta?
assistant: 150000
</example>

<example>
user: what files are in the directory src/?
assistant: [runs ls and sees foo.c, bar.c, baz.c]
user: which file contains the implementation of foo?
assistant: src/foo.c
</example>

When you run a non-trivial bash command, you should explain what the command does and why you are running it, to make sure the user understands what you are doing (this is especially important when you are running a command that will make changes to the user's system).
Remember that your output will be displayed on a command line interface. Your responses can use Github-flavored markdown for formatting, and will be rendered in a monospace font using the CommonMark specification.
Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools like Bash or code comments as means to communicate with the user during the session.
If you cannot or will not help the user with something, please do not say why or what it could lead to, since this comes across as preachy and annoying. Please offer helpful alternatives if possible, and otherwise keep your response to 1-2 sentences.
Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
IMPORTANT: Keep your responses short, since they will be displayed on a command line interface.

# Proactiveness
You are allowed to be proactive, but only when the user asks you to do something. You should strive to strike a balance between:
- Doing the right thing when asked, including taking actions and follow-up actions
- Not surprising the user with actions you take without asking
For example, if the user asks you how to approach something, you should do your best to answer their question first, and not immediately jump into taking actions.

# Following conventions
When making changes to files, first understand the file's code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.
- NEVER assume that a given library is available, even if it is well known. Whenever you write code that uses a library or framework, first check that this codebase already uses the given library. For example, you might look at neighboring files, or check the package.json (or cargo.toml, and so on depending on the language).
- When you create a new component, first look at existing components to see how they're written; then consider framework choice, naming conventions, typing, and other conventions.
- When you edit a piece of code, first look at the code's surrounding context (especially its imports) to understand the code's choice of frameworks and libraries. Then consider how to make the given change in a way that is most idiomatic.
- Always follow security best practices. Never introduce code that exposes or logs secrets and keys. Never commit secrets or keys to the repository.

# Code style
- IMPORTANT: DO NOT ADD ***ANY*** COMMENTS unless asked

# Task Management
You have access to the TodoWrite tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.

Examples:

<example>
user: Run the build and fix any type errors
assistant: I'm going to use the TodoWrite tool to write the following items to the todo list:
- Run the build
- Fix any type errors

I'm now going to run the build using Bash.

Looks like I found 10 type errors. I'm going to use the TodoWrite tool to write 10 items to the todo list.

marking the first todo as in_progress

Let me start working on the first item...

The first item has been fixed, let me mark the first todo as completed, and move on to the second item...
..
..
</example>

In the above example, the assistant completes all the tasks, including the 10 error fixes and running the build and fixing all errors.

<example>
user: Help me write a new feature that allows users to track their usage metrics and export them to various formats

assistant: I'll help you implement a usage metrics tracking and export feature. Let me first use the TodoWrite tool to plan this task.
Adding the following todos to the todo list:
1. Research existing metrics tracking in the codebase
2. Design the metrics collection system
3. Implement core metrics tracking functionality
4. Create export functionality for different formats

Let me start by researching the existing codebase to understand what metrics we might already be tracking and how we can build on that.

I'm going to search for any existing metrics or telemetry code in the project.

I've found some existing telemetry code. Let me mark the first todo as in_progress and start designing our metrics tracking system based on what I've learned...

[Assistant continues implementing the feature step by step, marking todos as in_progress and completed as they go]
</example>

<example>
user: create a new node project

assistant: I'll help create a new Node.js project. First, let me check the current directory structure and plan the steps.

*Creates todo list with: 1. Check current directory, 2. Create project directory if needed, 3. Initialize npm package, 4. Create basic project files*

Let me start by examining the current setup.

[Uses list tool to see directory contents]

Based on what I see, I'll create the project in a new subdirectory to avoid conflicts.

[Uses bash tool to create directory and initialize project]
</example>

# Doing tasks
The user will primarily request you perform software engineering tasks. This includes solving bugs, adding new functionality, refactoring code, explaining code, and more. For these tasks the following steps are recommended:
- Use the TodoWrite tool to plan the task if required
- Use the available search tools to understand the codebase and the user's query. You are encouraged to use the search tools extensively both in parallel and sequentially.
- Implement the solution using all tools available to you
- If a command fails due to a missing tool or dependency (like "npm: command not found" or "bun: command not found"), attempt to install it using package managers like apt, brew, or other appropriate installation methods for the current platform
- Be persistent and try multiple approaches when initial attempts fail - don't give up after the first error
- Verify the solution if possible with tests. NEVER assume specific test framework or test script. Check the README or search codebase to determine the testing approach.
- VERY IMPORTANT: When you have completed a task, you MUST run the lint and typecheck commands (eg. npm run lint, npm run typecheck, ruff, etc.) with Bash if they were provided to you to ensure your code is correct. If you cannot unable to find the correct command, ask the user for the command to run and if they supply it, proactively suggest writing it to CLAUDE.md so that you will know to run it next time.
NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.

- For project creation tasks, always use the TodoWrite tool to plan steps and use Bash tool to execute commands like npm init, mkdir, etc.
- If the current directory already contains a package.json, consider creating the new project in a subdirectory to avoid conflicts.
- When tools are missing, try multiple installation approaches: apt-get, brew, curl scripts, etc.

- Tool results and user messages may include <system-reminder> tags. <system-reminder> tags contain useful information and reminders. They are NOT part of the user's provided input or the tool result.

# Tool usage policy
- When doing file search, prefer to use the Task tool in order to reduce context usage.
- You should proactively use the Task tool with specialized agents when the task at hand matches the agent's description.

- When WebFetch returns a message about a redirect to a different host, you should immediately make a new WebFetch request with the redirect URL provided in the response.
- You have the capability to call multiple tools in a single response. When multiple independent pieces of information requested, batch your tool calls together for optimal performance. When making multiple bash tool calls, you MUST send a single message with multiple tools calls to run the calls in parallel. For example, if you need to run "git status" and "git diff", send a single message with multiple tools calls to run the calls in parallel.

IMPORTANT: Always use the TodoWrite tool to plan and track tasks throughout the conversation.

# Code References

When referencing specific functions or lines of code, use the pattern \`file_path:line_number\` to allow the user to easily navigate to the source code location.

<example>
user: Where are errors from the client handled?
assistant: Clients are marked as failed in the \`connectToServer\` function in src/services/process.ts:712.
</example>`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function provider(_providerID: string, _modelID: string): string[] {
  // Use the same comprehensive system prompt for all providers
  return [BASE_SYSTEM_PROMPT];
}

export async function environment(): Promise<string[]> {
  const cwd = process.cwd();

  // Check if we're in a git repository
  let isGitRepo = false;
  let gitInfo = '';
  try {
    await fs.promises.access(path.join(cwd, '.git'));
    isGitRepo = true;

    // Get basic git info
    try {
      const gitStatus = await fs.promises.readFile(path.join(cwd, '.git', 'HEAD'), 'utf-8');
      if (gitStatus.startsWith('ref: ')) {
        const branch = gitStatus.split('/').pop()?.trim();
        gitInfo = `Branch: ${branch ?? 'unknown'}`;
      }
    } catch {
      gitInfo = 'Git repository detected';
    }
  } catch {
    isGitRepo = false;
  }

  const platform = process.platform;
  const today = new Date().toDateString();

  return [
    [
      `Here is some useful information about the environment you are running in:`,
      `<env>`,
      `  Working directory: ${cwd}`,
      `  Is directory a git repo: ${isGitRepo ? 'yes' : 'no'}`,
      `  Platform: ${platform}`,
      `  Today's date: ${today}`,
      isGitRepo ? `  Git info: ${gitInfo}` : '',
      `</env>`,
    ]
      .filter(Boolean)
      .join('\n'),
  ];
}

export async function projectStructure(): Promise<string[]> {
  const cwd = process.cwd();

  try {
    // Get a basic directory listing (similar to ripgrep tree but simpler)
    const items = await fs.promises.readdir(cwd, { withFileTypes: true });
    const structure = items
      .filter(item => !item.name.startsWith('.') && item.name !== 'node_modules')
      .map(item => {
        const prefix = item.isDirectory() ? '📁' : '📄';
        return `  ${prefix} ${item.name}`;
      })
      .join('\n');

    return [`<project>`, structure, `</project>`];
  } catch (error) {
    return [`<project>Unable to read project structure</project>`];
  }
}

// Local rule files to look for
const LOCAL_RULE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'CONTEXT.md',
  'README.md',
  '.cursorrules',
  '.cursorrules.md',
];

// Global rule files
const GLOBAL_RULE_FILES = [
  path.join(os.homedir(), '.config', 'fosscode', 'AGENTS.md'),
  path.join(os.homedir(), '.fosscode', 'AGENTS.md'),
  path.join(os.homedir(), '.claude', 'CLAUDE.md'),
];

export async function customRules(): Promise<string[]> {
  const cwd = process.cwd();
  const foundRules: string[] = [];

  // Check for local rule files
  for (const ruleFile of LOCAL_RULE_FILES) {
    try {
      const filePath = path.join(cwd, ruleFile);
      await fs.promises.access(filePath);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      if (content.trim()) {
        foundRules.push(`## Local Rules (${ruleFile})\n${content}`);
      }
    } catch {
      // File doesn't exist or can't be read
    }
  }

  // Check for global rule files
  for (const ruleFile of GLOBAL_RULE_FILES) {
    try {
      await fs.promises.access(ruleFile);
      const content = await fs.promises.readFile(ruleFile, 'utf-8');
      if (content.trim()) {
        foundRules.push(`## Global Rules (${path.basename(ruleFile)})\n${content}`);
      }
    } catch {
      // File doesn't exist or can't be read
    }
  }

  return foundRules;
}

export function tools(mode?: 'code' | 'thinking'): string[] {
  const availableTools = listAvailableTools();

  // Filter tools based on mode
  let filteredTools = availableTools;
  if (mode === 'thinking') {
    const allowedTools = ['read', 'grep', 'list', 'webfetch'];
    filteredTools = availableTools.filter(tool => allowedTools.includes(tool.name));
  }

  const toolDescriptions = filteredTools
    .map(tool => `- **${tool.name}**: ${tool.description}`)
    .join('\n');

  return [`## Available Tools\n${toolDescriptions}`];
}

export function conversationContext(messages: Message[], maxMessages: number = 5): string[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Get the most recent messages (excluding the current user message)
  const recentMessages = messages
    .filter(msg => msg.role !== 'user' || messages.indexOf(msg) !== messages.length - 1)
    .slice(-maxMessages);

  if (recentMessages.length === 0) {
    return [];
  }

  const contextLines = recentMessages.map(msg => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
    const timeStr = timestamp ? ` (${timestamp})` : '';
    return `${role}${timeStr}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`;
  });

  return [
    `## Recent Conversation Context\n${contextLines.join('\n')}`,
    '',
    'Use this context to maintain continuity in the conversation and avoid repeating information already discussed.',
  ];
}

export function fileContext(): string[] {
  try {
    const fileTracker = fileTrackerManager.getFileTracker();
    const recentFiles = fileTracker.getRecentlyAccessedFiles(30); // Last 30 minutes

    if (recentFiles.length === 0) {
      return [];
    }

    const fileLines = recentFiles.slice(0, 10).map(file => {
      const tools = file.toolsUsed.length > 0 ? ` (used by: ${file.toolsUsed.join(', ')})` : '';
      const timeAgo = Math.round((Date.now() - file.lastAccessed.getTime()) / 1000 / 60);
      return `- ${path.relative(process.cwd(), file.filePath)} (${file.accessCount} accesses, ${timeAgo}min ago)${tools}`;
    });

    return [
      `## Recently Accessed Files\n${fileLines.join('\n')}`,
      '',
      'These files have been accessed recently in this session. Consider their content when responding to user requests.',
    ];
  } catch (error) {
    // Silently ignore file tracking errors
    return [];
  }
}

export async function promptHistoryContext(): Promise<string[]> {
  try {
    const promptHistory = new PromptHistoryManager();
    await promptHistory.initialize();
    const history = promptHistory.getHistory();

    if (history.length === 0) {
      return [];
    }

    // Get the most recent prompts (limit to last 10 for context window management)
    const recentPrompts = history.slice(-10);
    const historyLines = recentPrompts.map((prompt, index) => {
      const promptNumber = history.length - recentPrompts.length + index + 1;
      return `${promptNumber}. ${prompt}`;
    });

    return [
      `## Recent Prompt History\n${historyLines.join('\n')}`,
      '',
      "This shows your recent prompts in this session. Use this context to understand the user's current focus and avoid repeating recent work.",
    ];
  } catch (error) {
    // Silently ignore prompt history errors
    return [];
  }
}

/**
 * Generate a complete system prompt for a provider
 */
export async function generate(
  providerID: string,
  modelID: string,
  mode?: 'code' | 'thinking',
  messages?: Message[]
): Promise<string> {
  const environmentInfo = await environment();
  const projectStructureInfo = await projectStructure();
  const customRulesInfo = await customRules();
  const conversationInfo = messages ? conversationContext(messages) : [];
  const filesInfo = fileContext();
  const promptHistoryInfo = await promptHistoryContext();

  const parts = [
    ...provider(providerID, modelID),
    ...environmentInfo,
    ...projectStructureInfo,
    ...conversationInfo,
    ...filesInfo,
    ...promptHistoryInfo,
    mode
      ? [
          `## Current Mode\nYou are currently in **${mode} mode**. ${mode === 'thinking' ? 'You can only use read-only tools (read, grep, list, webfetch). You cannot make any changes to files or run commands.' : 'You can use all available tools including those that modify files and run commands.'}`,
        ]
      : [],
    ...tools(mode),
    ...customRulesInfo,
  ];

  return parts.filter(Boolean).join('\n\n');
}
