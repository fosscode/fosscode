import { Tool, ToolParameter, ToolResult } from '../types/index.js';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  id: string;
}

// Global state to store todos across sessions
const todoState: { [sessionId: string]: TodoItem[] } = {};

export class TodoWriteTool implements Tool {
  name = 'todowrite';
  description = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool
Use this tool proactively in these scenarios:
1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. After completing a task - Mark it complete and add any new follow-up tasks
7. When you start working on a new task, mark the todo as in_progress. Ideally you should only have one todo as in_progress at a time

## Task States and Management
1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully
   - cancelled: Task no longer needed

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Cancel tasks that become irrelevant

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`;

  parameters: ToolParameter[] = [
    {
      name: 'todos',
      type: 'array',
      required: true,
      description:
        'The updated todo list with objects containing content, status, priority, and id fields',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const sessionId = 'default';
    const todos = params.todos as TodoItem[];

    todoState[sessionId] = todos;

    const incompleteTodos = todos.filter(todo => todo.status !== 'completed');

    return {
      success: true,
      data: {
        todos: todos,
        incompleteTodos: incompleteTodos.length,
        content: JSON.stringify(todos, null, 2),
      },
      metadata: {
        title: `${incompleteTodos.length} todos`,
        todos: todos,
      },
    };
  }
}

export class TodoReadTool implements Tool {
  name = 'todoread';
  description = `Use this tool to read your todo list. This tool should be used proactively and frequently to ensure that you are aware of the status of the current task list. You should make use of this tool as often as possible, especially in the following situations:
- At the beginning of conversations to see what's pending
- Before starting new tasks to prioritize work
- When the user asks about previous tasks or plans
- Whenever you're uncertain about what to do next
- After completing tasks to update your understanding of remaining work
- After every few messages to ensure you're on track

Usage:
- This tool takes in no parameters. So leave the input blank or empty. DO NOT include a dummy object, placeholder string or a key like "input" or "empty". LEAVE IT BLANK.
- Returns a list of todo items with their status, priority, and content
- Use this information to track progress and plan next steps
- If no todos exist yet, an empty list will be returned`;

  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    const sessionId = 'default';
    const todos = todoState[sessionId] || [];

    const incompleteTodos = todos.filter(todo => todo.status !== 'completed');

    return {
      success: true,
      data: {
        todos: todos,
        incompleteTodos: incompleteTodos.length,
        content: JSON.stringify(todos, null, 2),
      },
      metadata: {
        title: `${incompleteTodos.length} todos`,
        todos: todos,
      },
    };
  }
}
