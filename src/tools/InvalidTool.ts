import { Tool, ToolParameter, ToolResult } from '../types/index.js';

/**
 * Invalid Tool Handler
 * Provides error handling and user-friendly messages for invalid tool operations
 * This tool serves as a fallback when tool operations fail or are invalid
 */
export class InvalidTool implements Tool {
  name = 'invalid';
  description = 'Handles invalid tool operations and provides error recovery guidance';

  parameters: ToolParameter[] = [
    {
      name: 'operation',
      type: 'string',
      description: 'The invalid operation that was attempted',
      required: true,
    },
    {
      name: 'reason',
      type: 'string',
      description: 'Reason why the operation was invalid',
      required: false,
      defaultValue: 'Unknown error',
    },
    {
      name: 'suggestions',
      type: 'boolean',
      description: 'Whether to provide recovery suggestions',
      required: false,
      defaultValue: true,
    },
    {
      name: 'context',
      type: 'string',
      description: 'Additional context about the failed operation',
      required: false,
      defaultValue: '',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { operation, reason = 'Unknown error', suggestions = true, context = '' } = params;

      if (!operation) {
        return {
          success: false,
          error: 'Operation parameter is required',
        };
      }

      const errorAnalysis = this.analyzeError(operation, reason, context);
      const recoverySuggestions = suggestions ? this.generateSuggestions(operation, reason) : [];

      return {
        success: false,
        error: `Invalid operation: ${operation}. ${reason}`,
        data: {
          operation,
          reason,
          context,
          errorCategory: errorAnalysis.category,
          severity: errorAnalysis.severity,
          recoverySuggestions,
          troubleshootingSteps: this.getTroubleshootingSteps(operation),
        },
        metadata: {
          errorCode: errorAnalysis.errorCode,
          timestamp: new Date().toISOString(),
          suggestionsEnabled: suggestions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to handle invalid operation: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private analyzeError(
    _operation: string,
    reason: string,
    context: string
  ): {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    errorCode: string;
  } {
    // Categorize the error based on operation and reason
    const errorPatterns = {
      // File system errors
      file_not_found: /file.*not.*found|no.*such.*file/i,
      permission_denied: /permission.*denied|access.*denied/i,
      disk_full: /disk.*full|no.*space/i,

      // Network errors
      connection_failed: /connection.*failed|network.*error/i,
      timeout: /timeout|timed.*out/i,
      dns_error: /dns|name.*resolution/i,

      // Tool-specific errors
      invalid_parameters: /invalid.*parameter|missing.*required/i,
      unsupported_operation: /unsupported|not.*supported/i,
      resource_exhausted: /resource.*exhausted|limit.*exceeded/i,

      // System errors
      out_of_memory: /out.*of.*memory/i,
      process_killed: /killed|terminated/i,
      system_error: /system.*error/i,
    };

    let category = 'unknown';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Determine category and severity
    for (const [errorType, pattern] of Object.entries(errorPatterns)) {
      if (pattern.test(reason) || pattern.test(context)) {
        category = errorType;

        // Set severity based on error type
        switch (errorType) {
          case 'file_not_found':
          case 'invalid_parameters':
            severity = 'low';
            break;
          case 'permission_denied':
          case 'connection_failed':
          case 'timeout':
            severity = 'medium';
            break;
          case 'disk_full':
          case 'resource_exhausted':
          case 'out_of_memory':
            severity = 'high';
            break;
          case 'system_error':
          case 'process_killed':
            severity = 'critical';
            break;
          default:
            severity = 'medium';
        }
        break;
      }
    }

    // Generate error code
    const errorCode = `ERR_${category.toUpperCase()}_${Date.now().toString().slice(-4)}`;

    return { category, severity, errorCode };
  }

  private generateSuggestions(operation: string, reason: string): string[] {
    const suggestions: string[] = [];

    // Common recovery suggestions based on operation type
    if (operation.includes('file') || operation.includes('read') || operation.includes('write')) {
      suggestions.push('Check if the file path is correct and the file exists');
      suggestions.push('Verify file permissions and access rights');
      suggestions.push('Ensure the directory structure is intact');
    }

    if (operation.includes('network') || operation.includes('http') || operation.includes('api')) {
      suggestions.push('Check network connectivity and firewall settings');
      suggestions.push('Verify API endpoints and authentication credentials');
      suggestions.push('Try again later as the service might be temporarily unavailable');
    }

    if (operation.includes('command') || operation.includes('exec')) {
      suggestions.push('Verify the command syntax and required parameters');
      suggestions.push('Check if required dependencies are installed');
      suggestions.push('Ensure the execution environment has necessary permissions');
    }

    if (operation.includes('test')) {
      suggestions.push('Check if test framework is properly installed and configured');
      suggestions.push('Verify test file paths and naming conventions');
      suggestions.push('Ensure all test dependencies are available');
    }

    // Specific suggestions based on reason
    if (reason.includes('permission')) {
      suggestions.push('Run the operation with appropriate privileges (sudo/admin)');
      suggestions.push('Check file/directory ownership and permissions');
    }

    if (reason.includes('timeout')) {
      suggestions.push('Increase timeout values if applicable');
      suggestions.push('Check system resources and performance');
      suggestions.push('Try the operation during off-peak hours');
    }

    if (reason.includes('memory') || reason.includes('resource')) {
      suggestions.push('Free up system resources (close unused applications)');
      suggestions.push('Increase available memory/RAM if possible');
      suggestions.push('Consider processing data in smaller batches');
    }

    // Add general suggestions if we don't have specific ones
    if (suggestions.length === 0) {
      suggestions.push('Review the operation parameters and try again');
      suggestions.push('Check system logs for additional error details');
      suggestions.push('Contact system administrator if the issue persists');
    }

    return suggestions;
  }

  private getTroubleshootingSteps(operation: string): string[] {
    const steps: string[] = [
      '1. Gather more information about the error',
      '2. Check system resources and connectivity',
      '3. Review recent system changes or updates',
      '4. Test with minimal parameters to isolate the issue',
    ];

    // Use operation parameter for specific guidance
    if (operation) {
      steps[0] = `1. Gather more information about the ${operation} error`;
    }

    // Add operation-specific troubleshooting steps
    if (operation && operation.includes('file')) {
      steps.push('5. Verify file system integrity');
      steps.push('6. Check disk space and quotas');
    }

    if (operation && operation.includes('network')) {
      steps.push('5. Test network connectivity with ping/traceroute');
      steps.push('6. Check DNS resolution and proxy settings');
    }

    if (operation && (operation.includes('database') || operation.includes('db'))) {
      steps.push('5. Verify database connection and credentials');
      steps.push('6. Check database server status and logs');
    }

    steps.push('7. Document the issue with full error details');
    steps.push('8. Seek help from relevant documentation or community');

    return steps;
  }
}
