import { ProviderResponse, ProviderType, Message } from '../types/index.js';
import {
  getContextLimit,
  calculateContextPercentage,
  formatContextUsage,
} from './contextLimits.js';
import type { ProviderManager } from '../providers/ProviderManager.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ContextInfo {
  usedTokens: number;
  limit?: number | undefined;
  percentage?: number | undefined;
  provider: ProviderType;
  model: string;
}

export interface EnhancedProviderResponse extends ProviderResponse {
  context?: ContextInfo;
}

export async function summarize(
  messages: Message[],
  provider: ProviderType,
  model: string,
  sendMessage: ProviderManager['sendMessage']
): Promise<Message> {
  const summarizationPrompt = `Please provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.`;

  const messagesToSummarize = messages.filter(m => m.role !== 'summary');

  const response = await sendMessage(
    provider,
    [
      ...messagesToSummarize,
      {
        role: 'user',
        content: summarizationPrompt,
        timestamp: new Date(),
      },
    ],
    model,
    false, // isVerbose
    'thinking' // mode
  );

  return {
    role: 'summary',
    content: response.content,
    timestamp: new Date(),
    ...(response.usage && { usage: response.usage }),
  };
}

export function enhanceWithContext(
  response: ProviderResponse,
  provider: ProviderType,
  model: string
): EnhancedProviderResponse {
  if (!response.usage) {
    return response;
  }

  const limit = getContextLimit(provider, model);
  const percentage = calculateContextPercentage(response.usage.totalTokens, limit);

  const context: ContextInfo = {
    usedTokens: response.usage.totalTokens,
    limit,
    percentage,
    provider,
    model,
  };

  return {
    ...response,
    context,
  };
}

export type ContextDisplayFormat = 'percentage' | 'tokens' | 'both';

export function formatContextDisplay(
  context?: ContextInfo,
  format: ContextDisplayFormat = 'both'
): string | undefined {
  if (!context) {
    return undefined;
  }

  return formatContextUsage(context.usedTokens, context.limit, format);
}

export type ContextWarningLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export function getContextWarningLevel(percentage?: number): ContextWarningLevel {
  if (!percentage) {
    return 'none';
  }

  if (percentage >= 95) {
    return 'critical';
  } else if (percentage >= 85) {
    return 'high';
  } else if (percentage >= 75) {
    return 'medium';
  } else if (percentage >= 60) {
    return 'low';
  }

  return 'none';
}

export function getContextWarningMessage(context?: ContextInfo): string | undefined {
  if (!context?.percentage) {
    return undefined;
  }

  const level = getContextWarningLevel(context.percentage);

  if (level === 'none') {
    return undefined;
  }

  const percentage = context.percentage.toFixed(1);
  const levelText = {
    low: 'approaching',
    medium: 'moderate',
    high: 'high',
    critical: 'critical',
  }[level];

  return `Context usage is ${levelText} (${percentage}%). Consider shortening your prompt or switching to a model with higher context limits.`;
}

export interface RepoMapEntry {
  path: string;
  type: 'file' | 'directory';
  children?: RepoMapEntry[];
  summary?: string;
}

export async function generateRepoMap(
  rootDir: string = process.cwd(),
  maxDepth: number = 3,
  includePatterns: string[] = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.py',
    '**/*.java',
    '**/*.cpp',
    '**/*.c',
    '**/*.h',
    '**/*.go',
    '**/*.rs',
    '**/*.php',
    '**/*.rb',
    '**/*.html',
    '**/*.css',
    '**/*.md',
    '**/*.json',
    '**/*.yml',
    '**/*.yaml',
  ],
  excludePatterns: string[] = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.log',
    '**/.DS_Store',
  ]
): Promise<RepoMapEntry[]> {
  async function walk(dir: string, depth: number = 0): Promise<RepoMapEntry[]> {
    if (depth > maxDepth) return [];

    const entries: RepoMapEntry[] = [];
    let items: string[];

    try {
      items = await fs.promises.readdir(dir);
    } catch {
      return [];
    }

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(rootDir, fullPath);

      // Check exclude patterns
      if (
        excludePatterns.some(pattern =>
          new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')).test(relativePath)
        )
      ) {
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        continue;
      }

      const entry: RepoMapEntry = {
        path: relativePath,
        type: stat.isDirectory() ? 'directory' : 'file',
      };

      if (stat.isDirectory()) {
        entry.children = await walk(fullPath, depth + 1);
      } else {
        // Check if file matches include patterns
        const matches = includePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
          return regex.test(relativePath);
        });

        if (matches) {
          // Generate summary for code files
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const lines = content.split('\n').slice(0, 50); // First 50 lines
            const summary = lines.join('\n').substring(0, 500); // First 500 chars
            entry.summary = summary + (content.length > 500 ? '...' : '');
          } catch {
            // Ignore read errors
          }
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  return await walk(rootDir);
}

export function formatRepoMap(map: RepoMapEntry[], indent: string = ''): string {
  let result = '';

  for (const entry of map) {
    if (entry.type === 'directory') {
      result += `${indent}📁 ${entry.path}/\n`;
      if (entry.children) {
        result += formatRepoMap(entry.children, indent + '  ');
      }
    } else {
      result += `${indent}📄 ${entry.path}`;
      if (entry.summary) {
        result += `\n${indent}   ${entry.summary.replace(/\n/g, `\n${indent}   `)}`;
      }
      result += '\n';
    }
  }

  return result;
}
