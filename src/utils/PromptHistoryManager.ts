import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface HistoryEntry {
  prompt: string;
  timestamp: string;
}

export class PromptHistoryManager {
  private historyPath: string;
  private maxHistorySize: number;
  private history: HistoryEntry[] = [];

  constructor(maxHistorySize: number = 15) {
    // Use XDG config directory: ~/.config/fosscode/prompt_history/
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.historyPath = path.join(xdgConfigDir, 'fosscode', 'prompt_history', 'history.json');
    this.maxHistorySize = maxHistorySize;
  }

  async initialize(): Promise<void> {
    await this.loadHistory();
  }

  private async ensureHistoryDirectory(): Promise<void> {
    const historyDir = path.dirname(this.historyPath);
    await fs.mkdir(historyDir, { recursive: true });
  }

  private async loadHistory(): Promise<void> {
    try {
      await this.ensureHistoryDirectory();
      const historyData = await fs.readFile(this.historyPath, 'utf-8');
      const loadedHistory = JSON.parse(historyData);

      // Validate the loaded history format
      if (Array.isArray(loadedHistory)) {
        this.history = loadedHistory.filter(
          entry =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.prompt === 'string' &&
            typeof entry.timestamp === 'string'
        );
      } else {
        this.history = [];
      }
    } catch {
      // If history doesn't exist or is corrupted, start with empty history
      this.history = [];
      await this.saveHistory();
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await this.ensureHistoryDirectory();
      await fs.writeFile(this.historyPath, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('Failed to save prompt history:', error);
    }
  }

  async addPrompt(prompt: string): Promise<void> {
    if (!prompt.trim()) {
      return;
    }

    const trimmedPrompt = prompt.trim();

    // Don't add duplicate entries if the same prompt was just added
    const lastEntry = this.history[this.history.length - 1];
    if (lastEntry && lastEntry.prompt === trimmedPrompt) {
      return;
    }

    const entry: HistoryEntry = {
      prompt: trimmedPrompt,
      timestamp: new Date().toISOString(),
    };

    this.history.push(entry);

    // Maintain maximum history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    await this.saveHistory();
  }

  getHistory(): string[] {
    return this.history.map(entry => entry.prompt);
  }

  getHistoryWithTimestamps(): HistoryEntry[] {
    return [...this.history];
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveHistory();
  }

  getHistorySize(): number {
    return this.history.length;
  }

  async getPromptAt(index: number): Promise<string | null> {
    if (index < 0 || index >= this.history.length) {
      return null;
    }
    return this.history[index].prompt;
  }

  async getLatestPrompts(count: number): Promise<string[]> {
    const start = Math.max(0, this.history.length - count);
    return this.history.slice(start).map(entry => entry.prompt);
  }
}
