import { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { BashTool } from '../tools/BashTool.js';
import { ReadTool } from '../tools/ReadTool.js';

interface FileSearchProps {
  isActive: boolean;
  onFileAttach: (filePath: string, content: string) => void;
  onExit: () => void;
  themeColors: {
    header: string;
    inputPrompt: string;
    error: string;
    footer: string;
    userMessage: string;
  };
}

interface FileItem {
  name: string;
  type: 'file';
  size: number;
  modified: string;
}

export function FileSearch({ isActive, onFileAttach, onExit, themeColors }: FileSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (isActive) {
      setIsSearching(true);
      performFileSearch(debouncedSearchQuery).finally(() => {
        setIsSearching(false);
      });
    }
  }, [debouncedSearchQuery, isActive]);

  const performFileSearch = useCallback(async (query: string): Promise<void> => {
    try {
      const bashTool = new BashTool();

      // Check if we're in a git repository
      const gitCheck = await bashTool.execute({
        command: 'git rev-parse --git-dir > /dev/null 2>&1 && echo "git" || echo "no-git"',
        cwd: process.cwd(),
        timeout: 2000,
      });

      const isGitRepo = gitCheck.success && gitCheck.data?.stdout.trim() === 'git';

      if (!query.trim()) {
        // If no query, show recent files or common files
        let gitFiles: string[] = [];
        let taskFiles: string[] = [];

        if (isGitRepo) {
          // Use git ls-files to respect .gitignore
          const gitResult = await bashTool.execute({
            command: 'git ls-files | grep -E "\\.(ts|js|tsx|jsx|json|md)$"',
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (gitResult.success && gitResult.data) {
            gitFiles = gitResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        } else {
          // Fallback to find command
          const findResult = await bashTool.execute({
            command:
              'find . -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.json" -o -name "*.md"',
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (findResult.success && findResult.data) {
            gitFiles = findResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        }

        // Always include files from tasks directory
        const taskCommand = 'find ./tasks -type f 2>/dev/null || true';
        const taskResult = await bashTool.execute({
          command: taskCommand,
          cwd: process.cwd(),
          timeout: 3000,
        });
        if (taskResult.success && taskResult.data) {
          taskFiles = taskResult.data.stdout.split('\n').filter((f: string) => f.trim());
        }

        // Combine and deduplicate files
        const allFiles = [...gitFiles, ...taskFiles]
          .filter((file, index, arr) => arr.indexOf(file) === index)
          .slice(0, 20);

        const fileItems = allFiles.map((file: string) => ({
          name: file,
          type: 'file' as const,
          size: 0,
          modified: new Date().toISOString(),
        }));
        setSearchResults(fileItems);
        setSelectedIndex(0);
      } else {
        // Use git-aware search with pattern
        const escapedQuery = query.replace(/'/g, "'\\''"); // Escape single quotes
        let gitFiles: string[] = [];
        let taskFiles: string[] = [];

        if (isGitRepo) {
          // Use git ls-files with grep to respect .gitignore
          const gitResult = await bashTool.execute({
            command: `git ls-files | grep -i "${escapedQuery}"`,
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (gitResult.success && gitResult.data) {
            gitFiles = gitResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        } else {
          // Fallback to find command
          const findResult = await bashTool.execute({
            command: `find . -type f -iname "*${escapedQuery}*" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" -not -path "./build/*"`,
            cwd: process.cwd(),
            timeout: 5000,
          });
          if (findResult.success && findResult.data) {
            gitFiles = findResult.data.stdout.split('\n').filter((f: string) => f.trim());
          }
        }

        // Always include matching files from tasks directory
        const taskCommand = `find ./tasks -type f -iname "*${escapedQuery}*" 2>/dev/null || true`;
        const taskResult = await bashTool.execute({
          command: taskCommand,
          cwd: process.cwd(),
          timeout: 3000,
        });
        if (taskResult.success && taskResult.data) {
          taskFiles = taskResult.data.stdout.split('\n').filter((f: string) => f.trim());
        }

        // Combine and deduplicate files
        const allFiles = [...gitFiles, ...taskFiles]
          .filter((file, index, arr) => arr.indexOf(file) === index)
          .slice(0, 20);

        const fileItems = allFiles.map((file: string) => ({
          name: file,
          type: 'file' as const,
          size: 0,
          modified: new Date().toISOString(),
        }));
        setSearchResults(fileItems);
        setSelectedIndex(0);
      }
    } catch (error) {
      setSearchResults([]);
    }
  }, []);

  const attachFile = useCallback(
    async (file: FileItem) => {
      try {
        const readTool = new ReadTool();
        const result = await readTool.execute({
          filePath: file.name,
          withLineNumbers: true,
        });

        if (result.success && result.data) {
          const fileContent = result.data.content;
          onFileAttach(file.name, fileContent);
          onExit();
        }
      } catch (error) {
        // Handle error silently for now
      }
    },
    [onFileAttach, onExit]
  );

  const handleInput = useCallback(
    (inputChar: string, key: any) => {
      if (key.escape) {
        onExit();
        return;
      }

      if (key.upArrow) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
        return;
      }

      if (key.return) {
        if (searchResults.length > 0) {
          const selectedFile = searchResults[selectedIndex];
          attachFile(selectedFile);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (searchQuery.length > 0) {
          setSearchQuery(prev => prev.slice(0, -1));
        } else {
          onExit();
        }
        return;
      }

      if (inputChar && !key.ctrl && !key.meta && inputChar.length === 1) {
        setSearchQuery(prev => prev + inputChar);
        return;
      }
    },
    [searchResults, selectedIndex, searchQuery, attachFile, onExit]
  );

  // Expose input handler for parent component
  (FileSearch as any).handleInput = handleInput;

  if (!isActive) return null;

  const renderedResults = searchResults.slice(0, 5).map((file, index) => (
    <Text key={index} color={index === selectedIndex ? themeColors.userMessage : 'gray'}>
      {index === selectedIndex ? '▶ ' : '  '}
      {file.name} ({file.type})
    </Text>
  ));

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Text color={themeColors.header}>
        {`🔍 Search files: ${searchQuery || '<type to search>'}${isSearching ? ' ⏳' : ''}`}
      </Text>
      {isSearching ? (
        <Text color={themeColors.inputPrompt}>🔎 Searching...</Text>
      ) : searchResults.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {renderedResults}
          {searchResults.length > 5 && (
            <Text color={themeColors.footer}>{`... and ${searchResults.length - 5} more`}</Text>
          )}
        </Box>
      ) : searchQuery ? (
        <Text color={themeColors.error}>{`No files found matching "${searchQuery}"`}</Text>
      ) : (
        <Text color={themeColors.footer}>Start typing to search files...</Text>
      )}
      <Text color={themeColors.footer}>↑↓ navigate • Enter select • Esc cancel</Text>
    </Box>
  );
}
