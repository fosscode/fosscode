/**
 * Built-in Skills for fosscode
 *
 * These skills provide common workflows and best practices
 * for development tasks. They can be invoked via $skill-name syntax.
 */

import { Skill } from '../types/skills.js';

/**
 * $commit - Git commit workflow skill
 */
const commitSkill: Skill = {
  name: 'commit',
  description: 'Git commit workflow with best practices',
  version: '1.0.0',
  author: 'fosscode',
  source: 'builtin',
  enabled: true,
  tags: ['git', 'version-control', 'workflow'],
  triggers: {
    keywords: ['commit', 'git commit', 'save changes', 'stage changes'],
    patterns: ['\\bcommit\\b', '\\bgit\\s+add\\b'],
    confidenceThreshold: 0.6,
  },
  instructions: `You are helping with a git commit workflow. Follow these best practices:

1. **Review Changes First**
   - Run \`git status\` to see all modified, added, and deleted files
   - Run \`git diff\` to review the actual changes
   - Identify files that should NOT be committed (secrets, build artifacts, etc.)

2. **Stage Changes Carefully**
   - Use \`git add <file>\` for specific files rather than \`git add .\`
   - Verify staged changes with \`git diff --staged\`
   - Use \`git reset HEAD <file>\` to unstage if needed

3. **Write Good Commit Messages**
   - Use conventional commit format: type(scope): description
   - Types: feat, fix, docs, style, refactor, test, chore
   - Keep the first line under 72 characters
   - Add a blank line and detailed description if needed

4. **Pre-Commit Checklist**
   - Ensure tests pass if applicable
   - Verify no sensitive data is being committed
   - Check that related changes are grouped logically

5. **Commit Message Examples**
   - feat(auth): add OAuth2 login support
   - fix(api): handle null response from external service
   - docs(readme): update installation instructions
   - refactor(utils): extract date formatting to shared module

IMPORTANT:
- NEVER commit files containing secrets, API keys, or credentials
- NEVER use \`git add .\` without first reviewing changes
- Ask the user to confirm before making any commits`,
};

/**
 * $pr - Pull request creation skill
 */
const prSkill: Skill = {
  name: 'pr',
  description: 'Pull request creation and management workflow',
  version: '1.0.0',
  author: 'fosscode',
  source: 'builtin',
  enabled: true,
  tags: ['git', 'github', 'pull-request', 'workflow'],
  triggers: {
    keywords: ['pull request', 'pr', 'merge request', 'create pr', 'open pr'],
    patterns: ['\\bpr\\b', '\\bpull\\s*request\\b', '\\bmerge\\s*request\\b'],
    confidenceThreshold: 0.6,
  },
  instructions: `You are helping create a pull request. Follow these best practices:

1. **Pre-PR Checklist**
   - Ensure all changes are committed
   - Verify the branch is up-to-date with the base branch
   - Run tests and ensure they pass
   - Review the diff one more time

2. **Branch Management**
   - Use descriptive branch names: feature/add-auth, fix/null-pointer, docs/api-guide
   - Ensure the branch is pushed to the remote
   - Verify the correct base branch (usually main or develop)

3. **PR Title**
   - Use clear, descriptive titles
   - Follow conventional format if the project uses it
   - Examples: "Add user authentication", "Fix memory leak in cache"

4. **PR Description Template**
   \`\`\`markdown
   ## Summary
   Brief description of what this PR does and why.

   ## Changes
   - List of specific changes made
   - Another change
   - And another

   ## Testing
   - How to test these changes
   - Any specific test cases added

   ## Screenshots (if applicable)
   Add screenshots for UI changes

   ## Checklist
   - [ ] Tests pass
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)
   \`\`\`

5. **Using GitHub CLI**
   - \`gh pr create --title "Title" --body "Description"\`
   - \`gh pr create --web\` to open in browser
   - \`gh pr status\` to check PR status

6. **After Creating PR**
   - Request reviewers if required
   - Add relevant labels
   - Link to related issues

IMPORTANT:
- Always review the PR diff before submitting
- Ensure CI checks pass
- Be responsive to review feedback`,
};

/**
 * $test - Run and fix tests skill
 */
const testSkill: Skill = {
  name: 'test',
  description: 'Run and fix tests workflow',
  version: '1.0.0',
  author: 'fosscode',
  source: 'builtin',
  enabled: true,
  tags: ['testing', 'debugging', 'quality'],
  triggers: {
    keywords: ['test', 'tests', 'run tests', 'fix tests', 'failing test', 'test failure'],
    patterns: ['\\btest(s)?\\b', '\\bjest\\b', '\\bpytest\\b', '\\bmocha\\b'],
    confidenceThreshold: 0.5,
  },
  instructions: `You are helping with running and fixing tests. Follow these best practices:

1. **Discover Test Framework**
   - Check package.json for test scripts and dependencies
   - Look for test configuration files (jest.config.js, pytest.ini, etc.)
   - Identify the test directory structure

2. **Run Tests**
   - Run all tests first to see the current state
   - Common commands:
     - npm test / yarn test / bun test
     - jest
     - pytest
     - go test ./...
     - cargo test

3. **Analyze Failures**
   - Read error messages carefully
   - Identify the failing test file and test name
   - Look at the expected vs actual values
   - Check if it's a test bug or implementation bug

4. **Debugging Strategies**
   - Run single test in isolation
   - Add console.log/print statements
   - Check test setup/teardown
   - Verify mock configurations
   - Check for async/timing issues

5. **Fixing Tests**
   - Fix one test at a time
   - Re-run after each fix
   - Don't modify tests just to make them pass
   - Consider if the test expectation is correct

6. **Test Quality Checklist**
   - Tests are independent and isolated
   - Tests have clear assertions
   - Tests cover edge cases
   - Tests are readable and maintainable

7. **Common Issues**
   - Stale mocks or fixtures
   - Race conditions in async tests
   - Environment-specific failures
   - Missing test dependencies
   - Incorrect test data

IMPORTANT:
- Never delete failing tests without understanding why they fail
- Ask before modifying test expectations
- Consider if failing tests indicate real bugs`,
};

/**
 * $refactor - Code refactoring guidelines skill
 */
const refactorSkill: Skill = {
  name: 'refactor',
  description: 'Code refactoring guidelines and best practices',
  version: '1.0.0',
  author: 'fosscode',
  source: 'builtin',
  enabled: true,
  tags: ['refactoring', 'code-quality', 'maintenance'],
  triggers: {
    keywords: ['refactor', 'refactoring', 'clean up', 'improve code', 'code smell'],
    patterns: ['\\brefactor\\b', '\\bclean\\s*up\\b', '\\bcode\\s*smell\\b'],
    confidenceThreshold: 0.6,
  },
  instructions: `You are helping with code refactoring. Follow these best practices:

1. **Before Refactoring**
   - Ensure tests exist and pass
   - Understand the current code fully
   - Identify the specific problems to solve
   - Make a backup or ensure changes are tracked

2. **Refactoring Principles**
   - Make small, incremental changes
   - Run tests after each change
   - Commit frequently
   - One refactoring at a time

3. **Common Refactoring Patterns**
   - **Extract Function**: Break large functions into smaller ones
   - **Rename**: Use clear, descriptive names
   - **Extract Variable**: Replace complex expressions
   - **Inline**: Remove unnecessary abstractions
   - **Move**: Relocate code to appropriate modules
   - **Replace Conditional with Polymorphism**

4. **Code Smells to Address**
   - Long functions (>50 lines)
   - Deep nesting (>3 levels)
   - Duplicate code
   - Magic numbers/strings
   - Large classes
   - Long parameter lists
   - Feature envy
   - Inappropriate intimacy

5. **Safety Measures**
   - Keep functions pure when possible
   - Maintain backward compatibility
   - Update documentation
   - Consider performance implications

6. **Verification**
   - All tests still pass
   - No new warnings or errors
   - Code is more readable
   - Changes are logical and cohesive

IMPORTANT:
- Never refactor without tests as a safety net
- Don't change behavior during refactoring
- Ask for confirmation before large refactors
- Document significant architectural changes`,
};

/**
 * $debug - Debugging workflow skill
 */
const debugSkill: Skill = {
  name: 'debug',
  description: 'Debugging workflow and troubleshooting',
  version: '1.0.0',
  author: 'fosscode',
  source: 'builtin',
  enabled: true,
  tags: ['debugging', 'troubleshooting', 'errors'],
  triggers: {
    keywords: ['debug', 'error', 'bug', 'fix', 'not working', 'broken', 'issue', 'problem'],
    patterns: ['\\bdebug\\b', '\\berror\\b', '\\bbug\\b', '\\bnot\\s*working\\b'],
    confidenceThreshold: 0.5,
  },
  instructions: `You are helping debug an issue. Follow this systematic approach:

1. **Gather Information**
   - What is the expected behavior?
   - What is the actual behavior?
   - When did it start happening?
   - What changed recently?
   - Can it be reproduced consistently?

2. **Error Analysis**
   - Read the full error message carefully
   - Identify the error type and location
   - Check the stack trace for the root cause
   - Look for related log messages

3. **Reproduce the Issue**
   - Create a minimal reproduction case
   - Document the exact steps
   - Verify the environment matches production

4. **Isolate the Problem**
   - Binary search approach: disable half the code
   - Check recent changes with git diff/log
   - Test with minimal configuration
   - Verify external dependencies

5. **Debugging Techniques**
   - Add strategic logging/print statements
   - Use debugger breakpoints
   - Check variable values at key points
   - Trace the execution flow
   - Validate input/output at boundaries

6. **Common Causes**
   - Null/undefined values
   - Type mismatches
   - Race conditions
   - Resource leaks
   - Configuration errors
   - Environment differences
   - Dependency version issues

7. **Fix and Verify**
   - Make the minimal change to fix
   - Add a test for the bug
   - Verify the fix doesn't break other things
   - Consider similar issues elsewhere

8. **Document and Prevent**
   - Add comments explaining the fix
   - Update error handling if needed
   - Consider adding monitoring/logging
   - Update documentation if relevant

IMPORTANT:
- Don't assume you know the cause before investigating
- Verify fixes with tests
- Consider the root cause, not just symptoms
- Ask for more context if needed`,
};

/**
 * Get all built-in skills
 */
export function getBuiltinSkills(): Skill[] {
  return [commitSkill, prSkill, testSkill, refactorSkill, debugSkill];
}

/**
 * Get a built-in skill by name
 */
export function getBuiltinSkill(name: string): Skill | undefined {
  return getBuiltinSkills().find(s => s.name === name);
}
