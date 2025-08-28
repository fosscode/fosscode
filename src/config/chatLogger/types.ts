import { Message, ProviderType, ProviderResponse } from '../../types/index.js';

export interface ChatLogEntry {
  id: string;
  timestamp: Date;
  operation:
    | 'session_started'
    | 'session_ended'
    | 'message_sent'
    | 'message_received'
    | 'error'
    | 'command_executed'
    | 'file_attached'
    | 'mode_changed'
    | 'streaming_token'
    | 'backend_operation'
    | 'tool_execution'
    | 'api_call';
  data: any;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  provider: ProviderType;
  model: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  operations: ChatLogEntry[];
  status: 'active' | 'completed' | 'error';
}

export interface LogOperationData {
  message?: Message;
  attachedFiles?: { path: string; content: string }[];
  messageNumber?: number;
  response?: ProviderResponse;
  responseTime?: number;
  error?: string;
  stack?: string;
  context?: string;
  command?: string;
  result?: any;
  filePath?: string;
  fileSize?: number;
  fromMode?: string;
  toMode?: string;
  token?: string;
  isThinking?: boolean;
  tokenLength?: number;
  operation?: string;
  details?: any;
  duration?: number;
  success?: boolean;
  provider?: string;
  endpoint?: string;
  method?: string;
  requestData?: any;
  responseData?: any;
  statusCode?: number;
  toolName?: string;
  parameters?: any;
}
