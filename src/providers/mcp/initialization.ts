import { MCPInitializeRequest, MCPNotification, MCPInitializeResult } from './types.js';

export class MCPInitializationManager {
  async initializeMCP(
    sendRequest: (request: MCPInitializeRequest) => Promise<MCPInitializeResult>,
    sendRPCMessage: (message: MCPInitializeRequest | MCPNotification) => void,
    getNextRequestId: () => number
  ): Promise<void> {
    const initRequest: MCPInitializeRequest = {
      jsonrpc: '2.0',
      id: getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          sampling: {},
          elicitation: {},
        },
        clientInfo: {
          name: 'fosscode',
          title: 'Fosscode MCP Client',
          version: '0.0.12',
        },
      },
    };

    await sendRequest(initRequest);

    // Send initialized notification
    const initializedNotification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    sendRPCMessage(initializedNotification);
  }
}
