# fosscode Feature Roadmap

A comprehensive list of features to implement, organized by priority and category.

---

## High Priority

### Background Agents & Task Management

- [ ] **Background task execution** - Allow agents to run in the background while continuing to work on other tasks
- [ ] **Subagent spawning** - Launch specialized subagents for complex multi-step tasks
- [ ] **Task queue management** - Monitor and manage multiple concurrent background tasks
- [ ] **`/tasks` command** - List all running, queued, and completed background tasks
- [ ] **Task output streaming** - Stream background task output to main session on demand

### Checkpoint & Rewind System

- [ ] **Automatic checkpoints** - Save code state before each file modification
- [ ] **`/rewind` command** - Instantly revert to any previous checkpoint
- [ ] **Checkpoint diff viewer** - Show what changed between checkpoints
- [ ] **Checkpoint persistence** - Store checkpoints across sessions
- [ ] **Quick undo (Esc+Esc)** - Double-escape to undo last change instantly

### Enhanced Code Review

- [ ] **`/review` command** - Built-in code review workflow
- [ ] **Review against branch** - Compare current work against base branch
- [ ] **Prioritized findings** - Generate actionable review findings sorted by severity
- [ ] **Review presets** - Security review, performance review, style review modes
- [ ] **PR review integration** - Review pull requests before submission

---

## Medium Priority

### Agent Skills System

- [ ] **Skill definitions** - Create reusable instruction bundles for specific tasks
- [ ] **`$skill-name` invocation** - Invoke skills explicitly with `$` prefix
- [ ] **Auto-skill selection** - Automatically select relevant skills based on prompt
- [ ] **Custom skill creation** - User-defined skills stored in `~/.config/fosscode/skills/`
- [ ] **Skill sharing** - Import/export skills in portable format

### Enhanced LSP Integration

- [ ] **Go-to-definition** - Navigate to symbol definitions via LSP
- [ ] **Find references** - Find all references to symbols across codebase
- [ ] **Symbol renaming** - Rename symbols with LSP-powered refactoring
- [ ] **Code actions** - Access LSP code actions (quick fixes, refactors)
- [ ] **Workspace symbols** - Search symbols across entire workspace

### Image & Visual Support

- [ ] **Screenshot input** - Accept image files as context (design specs, error screenshots)
- [ ] **Image paste support** - Paste images directly into interactive composer
- [ ] **Visual diff display** - Render diffs with syntax highlighting
- [ ] **Diagram generation** - Generate ASCII/mermaid diagrams from descriptions

### Browser Integration

- [ ] **Browser automation tool** - Control browser directly from fosscode
- [ ] **Screenshot capture** - Capture browser screenshots during automation
- [ ] **DOM inspection** - Query and interact with web page elements
- [ ] **Network monitoring** - Monitor network requests during browser sessions
- [ ] **Headless mode** - Run browser automation without GUI

---

## Lower Priority

### IDE Extensions

- [ ] **VSCode extension** - Native VSCode extension for fosscode integration
- [ ] **JetBrains plugin** - IntelliJ/WebStorm plugin
- [ ] **Cursor/Windsurf support** - Compatibility with AI-native editors
- [ ] **Agent Client Protocol (ACP)** - Standardized protocol for IDE communication
- [ ] **In-editor diff preview** - Show proposed changes in editor before applying

### Desktop Application

- [ ] **Desktop GUI wrapper** - Electron/Tauri desktop application
- [ ] **Multi-session panels** - Manage multiple fosscode sessions in tabs
- [ ] **Visual file explorer** - Browse and select files visually
- [ ] **Integrated terminal** - Embedded terminal within desktop app
- [ ] **System tray integration** - Quick access from system tray

### Plugin & Extension System

- [ ] **Plugin API** - Define `@fosscode/plugin` package for extensions
- [ ] **Custom tool registration** - Plugins can register new tools
- [ ] **Hook system** - Pre/post hooks for tool execution, messages, sessions
- [ ] **Authentication providers** - Plugin-based auth for custom services
- [ ] **Theme plugins** - Custom UI themes via plugin system

### GitHub Actions Integration

- [ ] **`@fosscode` mentions** - Respond to `@fosscode` in GitHub comments
- [ ] **Issue triage** - Automatically triage and label issues
- [ ] **Auto PR creation** - Create PRs from issue descriptions
- [ ] **CI integration** - Run fosscode tasks in GitHub Actions workflows
- [ ] **Status checks** - Report fosscode review results as PR checks

### Advanced Configuration

- [ ] **Configurable spinner** - Enable/disable/customize loading animations
- [ ] **Context compaction settings** - Configure auto-compaction and pruning thresholds
- [ ] **Per-project config** - `.fosscode.json` for project-specific settings
- [ ] **Config profiles** - Switch between configuration profiles
- [ ] **Enterprise managed settings** - Remote configuration management for teams

### Security & Sandboxing

- [ ] **Sandboxed execution mode** - Run all commands in isolated environment
- [ ] **Network isolation** - Disable network access by default for tools
- [ ] **Resource limits** - Configurable CPU/memory limits for tool execution
- [ ] **Audit logging** - Log all tool executions for security review
- [ ] **Permission scopes** - Fine-grained permission system per tool/directory

---

## Quality of Life Improvements

### Terminal & UI Enhancements

- [ ] **Terminal auto-setup** - Auto-configure terminals (Kitty, Alacritty, Warp, Zed)
- [ ] **Shell formatter integration** - Format shell scripts with shfmt
- [ ] **Progress indicators** - Show progress for long-running bash commands
- [ ] **Streaming output preview** - Preview command output while running
- [ ] **Rich markdown rendering** - Better markdown display in terminal

### Session Management

- [ ] **Session pause/resume** - Pause session and resume later with full context
- [ ] **Session export** - Export session history to markdown/JSON
- [ ] **Session sharing** - Share sessions with teammates
- [ ] **Session templates** - Start new sessions from templates
- [ ] **Remote sessions** - Control fosscode from mobile app or web

### Model & Provider Improvements

- [ ] **Auto-model selection** - Automatically select best model for task type
- [ ] **Model fallback chain** - Fallback to alternative models on failure
- [ ] **Cost tracking** - Track and display token usage and estimated costs
- [ ] **Rate limit handling** - Graceful handling of rate limits with queuing
- [ ] **Model performance stats** - Track response times and success rates

### Search & Navigation

- [ ] **Semantic code search** - Search code by meaning, not just text
- [ ] **Codebase indexing** - Index codebase for faster searches
- [ ] **File bookmarks** - Bookmark frequently accessed files
- [ ] **Jump history** - Navigate back/forward through accessed files
- [ ] **Fuzzy file finder** - Quick file access with fuzzy matching

### MCP Enhancements

- [ ] **MCP wildcard permissions** - Allow `mcp__server__*` permission syntax
- [ ] **MCP server templates** - Quick setup templates for common MCP servers
- [ ] **MCP health monitoring** - Monitor MCP server health and auto-restart
- [ ] **MCP discovery** - Discover and suggest relevant MCP servers
- [ ] **MCP tool documentation** - In-app documentation for MCP tools

---

## Implementation Notes

### Priority Criteria
- **High**: Core workflow improvements, significant productivity gains
- **Medium**: Important but not blocking, moderate implementation effort
- **Lower**: Nice-to-have features, larger scope or specialized use cases

### Getting Started
1. Pick a feature from **High Priority** section
2. Create a task file in `tasks/` folder following AGENTS.md guidelines
3. Break down into subtasks with checkboxes
4. Implement incrementally with tests

### Dependencies
Some features have dependencies:
- Background agents requires task queue infrastructure
- IDE extensions require ACP protocol implementation
- Plugin system requires stable API design first
- Desktop app can build on existing TUI components

---

*Last updated: 2025-12-31*
