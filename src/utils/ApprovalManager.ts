import { AppConfig } from '../types/index.js';

export type ApprovalType = 'once' | 'session' | 'always';

export interface ApprovalRequest {
  type: 'command' | 'edit';
  command?: string;
  filePath?: string;
  oldString?: string;
  newString?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  type?: ApprovalType;
  reason?: string;
}

export class ApprovalManager {
  private config: AppConfig;
  private sessionApprovals: Record<string, ApprovalType> = {};

  constructor(config: AppConfig) {
    this.config = config;
    this.sessionApprovals = config.approvals?.session ? { ...config.approvals.session } : {};
  }

  /**
   * Check if approval is needed for a request
   */
  needsApproval(request: ApprovalRequest): boolean {
    // GOD mode bypass
    if (this.config.approvalMode?.godMode) {
      return false;
    }

    // Approval mode disabled
    if (!this.config.approvalMode?.enabled) {
      return false;
    }

    const key = this.getApprovalKey(request);

    // Check persistent approvals
    if (this.config.approvals && this.config.approvals.persistent[key] === 'always') {
      return false;
    }

    // Check session approvals
    if (this.sessionApprovals[key] === 'session' || this.sessionApprovals[key] === 'always') {
      return false;
    }

    // Check if command is in allowlist
    if (request.type === 'command' && request.command) {
      const commandBase = request.command.split(' ')[0];
      return this.config.approvalMode.allowlist.some(
        pattern => commandBase.includes(pattern) || pattern.includes(commandBase)
      );
    }

    // All edits require approval when mode is enabled
    if (request.type === 'edit') {
      return true;
    }

    return false;
  }

  /**
   * Record an approval decision
   */
  recordApproval(request: ApprovalRequest, type: ApprovalType): void {
    const key = this.getApprovalKey(request);

    if (type === 'always') {
      if (this.config.approvals === undefined) {
        this.config.approvals = { session: {}, persistent: {} };
      }
      this.config.approvals.persistent[key] = 'always';
    } else {
      this.sessionApprovals[key] = type;
    }
  }

  /**
   * Clear session approvals
   */
  clearSessionApprovals(): void {
    this.sessionApprovals = {};
  }

  /**
   * Get approval key for caching
   */
  private getApprovalKey(request: ApprovalRequest): string {
    if (request.type === 'command') {
      return `cmd:${request.command}`;
    } else if (request.type === 'edit') {
      return `edit:${request.filePath}`;
    }
    return 'unknown';
  }

  /**
   * Update config reference (for when config changes)
   */
  updateConfig(config: AppConfig): void {
    this.config = config;
    this.sessionApprovals = config.approvals?.session ? { ...config.approvals.session } : {};
  }
}
