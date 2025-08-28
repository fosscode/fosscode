// Mock dependencies before importing
jest.mock('../config/ConfigManager');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');

import { MCPCommand } from '../commands/MCPCommand';
import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const mockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockOs = os as jest.Mocked<typeof os>;

describe('MCPCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks
    mockConfigManager.mockClear();
    mockFs.stat.mockClear();
    mockFs.readdir.mockClear();
    mockFs.mkdir.mockClear();
    mockFs.writeFile.mockClear();

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('list', () => {
    it('should list MCP server configuration', async () => {
      const mockConfig = {
        providers: {
          mcp: {
            mcpServerCommand: 'npx',
            mcpServerArgs: ['-y', '@upstash/context7-mcp@latest'],
            mcpServerUrl: 'http://localhost:3000',
            mcpServers: {
              server1: {
                name: 'server1',
                mcpServerCommand: 'node',
                mcpServerArgs: ['server.js'],
                enabled: true,
                mcpServerUrl: 'http://localhost:3001',
              },
              server2: {
                name: 'server2',
                mcpServerCommand: 'python',
                mcpServerArgs: ['server.py'],
                enabled: false,
              },
            },
          },
        },
      };

      const mockConfigManagerInstance = {
        getConfig: jest.fn().mockReturnValue(mockConfig),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      // Mock file system operations
      mockOs.homedir.mockReturnValue('/home/user');
      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readdir.mockResolvedValue(['server1.json', 'server2.json', 'other.txt'] as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.list();

      expect(mockConfigManagerInstance.getConfig).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('MCP Server Configuration:')
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Legacy Single Server:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Multiple Servers:'));
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle error in list', async () => {
      const errorMessage = 'Config error';

      const mockConfigManagerInstance = {
        getConfig: jest.fn().mockImplementation(() => {
          throw new Error(errorMessage);
        }),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.list();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), errorMessage);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('add', () => {
    it('should add MCP server successfully', async () => {
      const name = 'test-server';
      const command = 'node';
      const args = ['server.js'];
      const options = { url: 'http://localhost:3000', enabled: true };

      const mockConfig = {
        providers: {
          mcp: {
            mcpServers: {},
          },
        },
      };

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockReturnValue(mockConfig),
        saveConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.add(name, command, args, options);

      expect(mockConfigManagerInstance.loadConfig).toHaveBeenCalled();
      expect(mockConfigManagerInstance.saveConfig).toHaveBeenCalled();
      expect(mockConfig.providers.mcp.mcpServers).toHaveProperty(name);
      expect((mockConfig.providers.mcp.mcpServers as any)[name]).toEqual({
        name,
        mcpServerCommand: command,
        mcpServerArgs: args,
        enabled: true,
        mcpServerUrl: options.url,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`✓ Added MCP server '${name}'`)
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle error in add', async () => {
      const name = 'test-server';
      const command = 'node';
      const args = ['server.js'];
      const errorMessage = 'Save error';

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockRejectedValue(new Error(errorMessage)),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.add(name, command, args);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), errorMessage);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('remove', () => {
    it('should remove MCP server successfully', async () => {
      const name = 'test-server';
      const mockConfig = {
        providers: {
          mcp: {
            mcpServers: {
              [name]: {
                name,
                mcpServerCommand: 'node',
                mcpServerArgs: ['server.js'],
                enabled: true,
              },
            },
          },
        },
      };

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockReturnValue(mockConfig),
        saveConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.remove(name);

      expect(mockConfigManagerInstance.loadConfig).toHaveBeenCalled();
      expect(mockConfigManagerInstance.saveConfig).toHaveBeenCalled();
      expect(mockConfig.providers.mcp.mcpServers as any).not.toHaveProperty(name);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`✓ Removed MCP server '${name}'`)
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle server not found in remove', async () => {
      const name = 'nonexistent-server';
      const mockConfig = {
        providers: {
          mcp: {
            mcpServers: {},
          },
        },
      };

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockReturnValue(mockConfig),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.remove(name);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error: MCP server '${name}' not found`)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('enable', () => {
    it('should enable MCP server successfully', async () => {
      const name = 'test-server';
      const mockConfig = {
        providers: {
          mcp: {
            mcpServers: {
              [name]: {
                name,
                mcpServerCommand: 'node',
                mcpServerArgs: ['server.js'],
                enabled: false,
              },
            },
          },
        },
      };

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockReturnValue(mockConfig),
        saveConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.enable(name);

      expect(mockConfigManagerInstance.loadConfig).toHaveBeenCalled();
      expect(mockConfigManagerInstance.saveConfig).toHaveBeenCalled();
      expect((mockConfig.providers.mcp.mcpServers as any)[name].enabled).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`✓ Enabled MCP server '${name}'`)
      );
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('should disable MCP server successfully', async () => {
      const name = 'test-server';
      const mockConfig = {
        providers: {
          mcp: {
            mcpServers: {
              [name]: {
                name,
                mcpServerCommand: 'node',
                mcpServerArgs: ['server.js'],
                enabled: true,
              },
            },
          },
        },
      };

      const mockConfigManagerInstance = {
        loadConfig: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockReturnValue(mockConfig),
        saveConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      const mcpCommand = new MCPCommand();
      await mcpCommand.disable(name);

      expect(mockConfigManagerInstance.loadConfig).toHaveBeenCalled();
      expect(mockConfigManagerInstance.saveConfig).toHaveBeenCalled();
      expect((mockConfig.providers.mcp.mcpServers as any)[name].enabled).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`✓ Disabled MCP server '${name}'`)
      );
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('createConfigFile', () => {
    it('should create config file successfully', async () => {
      const name = 'test-server';
      const command = 'node';
      const args = ['server.js'];
      const options = { url: 'http://localhost:3000' };

      mockOs.homedir.mockReturnValue('/home/user');
      mockPath.join.mockImplementation((...args) => args.join('/'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const mcpCommand = new MCPCommand();
      await mcpCommand.createConfigFile(name, command, args, options);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/home/user/.config/fosscode/mcp.d', {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/home/user/.config/fosscode/mcp.d/test-server.json',
        expect.stringContaining('"name": "test-server"')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ Created MCP config file:')
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle error in createConfigFile', async () => {
      const name = 'test-server';
      const command = 'node';
      const args = ['server.js'];
      const errorMessage = 'File system error';

      mockFs.mkdir.mockRejectedValue(new Error(errorMessage));

      const mcpCommand = new MCPCommand();
      await mcpCommand.createConfigFile(name, command, args);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), errorMessage);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
