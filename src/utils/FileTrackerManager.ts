import { FileTracker } from './FileTracker.js';

class FileTrackerManager {
  private static instance: FileTrackerManager;
  private fileTracker: FileTracker | null = null;

  private constructor() {}

  static getInstance(): FileTrackerManager {
    if (!FileTrackerManager.instance) {
      FileTrackerManager.instance = new FileTrackerManager();
    }
    return FileTrackerManager.instance;
  }

  /**
   * Initialize or get the current session's file tracker
   */
  getFileTracker(): FileTracker {
    if (!this.fileTracker) {
      this.fileTracker = new FileTracker();
    }
    return this.fileTracker;
  }

  /**
   * Start a new session (clears previous tracking)
   */
  startNewSession(): FileTracker {
    this.fileTracker = new FileTracker();
    return this.fileTracker;
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    return this.fileTracker?.getSessionSummary();
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    this.fileTracker?.clear();
  }
}

export const fileTrackerManager = FileTrackerManager.getInstance();
