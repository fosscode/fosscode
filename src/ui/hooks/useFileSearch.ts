import { useState, useCallback, useEffect } from 'react';
import { BashTool } from '../../tools/BashTool.js';
import { ReadTool } from '../../tools/ReadTool.js';

export interface FileSearchResult {
  name: string;
  type: 'file';
  size: number;
  modified: string;
}

export interface AttachedFile {
  path: string;
  content: string;
}

export function useFileSearch() {
  const [isFileSearchMode, setIsFileSearchMode] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);

  // Debounce file search queries to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(fileSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [fileSearchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (isFileSearchMode) {
      setIsSearchingFiles(true);
      performFileSearch(debouncedSearchQuery).finally(() => {
        setIsSearchingFiles(false);
      });
    }
  }, [debouncedSearchQuery, isFileSearchMode]);

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
        setFileSearchResults(fileItems);
        setSelectedFileIndex(0);
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
        setFileSearchResults(fileItems);
        setSelectedFileIndex(0);
      }
    } catch (error) {
      setFileSearchResults([]);
    }
  }, []);

  const attachFile = useCallback(async (file: FileSearchResult) => {
    try {
      const readTool = new ReadTool();
      const result = await readTool.execute({
        filePath: file.name,
        withLineNumbers: true,
      });

      if (result.success && result.data) {
        const fileContent = result.data.content;
        setAttachedFiles(prev => [
          ...prev,
          {
            path: file.name,
            content: fileContent,
          },
        ]);

        // Exit file search mode
        setIsFileSearchMode(false);
        setFileSearchQuery('');
        setFileSearchResults([]);
        setSelectedFileIndex(0);
      }
    } catch (error) {
      // Handle error silently for now
    }
  }, []);

  const exitFileSearch = useCallback(() => {
    setIsFileSearchMode(false);
    setFileSearchQuery('');
    setFileSearchResults([]);
    setSelectedFileIndex(0);
  }, []);

  const navigateFileResults = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'up') {
        setSelectedFileIndex(prev => (prev > 0 ? prev - 1 : fileSearchResults.length - 1));
      } else {
        setSelectedFileIndex(prev => (prev < fileSearchResults.length - 1 ? prev + 1 : 0));
      }
    },
    [fileSearchResults.length]
  );

  const selectCurrentFile = useCallback(() => {
    if (fileSearchResults.length > 0) {
      const selectedFile = fileSearchResults[selectedFileIndex];
      attachFile(selectedFile);
    }
  }, [fileSearchResults, selectedFileIndex, attachFile]);

  return {
    isFileSearchMode,
    setIsFileSearchMode,
    fileSearchQuery,
    setFileSearchQuery,
    fileSearchResults,
    selectedFileIndex,
    attachedFiles,
    setAttachedFiles,
    isSearchingFiles,
    attachFile,
    exitFileSearch,
    navigateFileResults,
    selectCurrentFile,
  };
}
