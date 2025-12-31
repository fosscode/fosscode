// MCP Module Exports
export { MCPManager } from './MCPManager.js';
export { MCPConnectionManager } from './MCPConnectionManager.js';
export { MCPToolManager } from './MCPToolManager.js';
export { MCPConfigManager } from './MCPConfigManager.js';
export { MCPProtocolHandler } from './MCPProtocolHandler.js';

// Permission utilities
export {
  matchWildcardPermission,
  isToolAllowed,
  parsePermissionRule,
  evaluatePermissions,
} from './MCPConfigManager.js';

// Templates
export {
  serverTemplates,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplates,
  getTemplateCategories,
  validateTemplateEnvVars,
} from './templates/index.js';

// Health event types
export type { MCPHealthEvent, MCPHealthEventHandler } from './MCPConnectionManager.js';

// Types
export type {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPServerHealth,
  MCPServerTemplate,
  MCPPermissionRule,
  MCPToolDocumentation,
} from './types.js';
