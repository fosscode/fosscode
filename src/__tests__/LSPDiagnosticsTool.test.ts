import { LSPDiagnosticsTool } from '../tools/LSPDiagnosticsTool.js';

describe('LSPDiagnosticsTool', () => {
  let lspDiagnosticsTool: LSPDiagnosticsTool;

  beforeEach(() => {
    lspDiagnosticsTool = new LSPDiagnosticsTool();
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(lspDiagnosticsTool.name).toBe('lsp-diagnostics');
      expect(lspDiagnosticsTool.description).toContain('Language Server Protocol');
    });

    it('should have required parameters', () => {
      expect(lspDiagnosticsTool.parameters).toHaveLength(6);
      const filesParam = lspDiagnosticsTool.parameters.find(p => p.name === 'files');
      expect(filesParam?.required).toBe(true);
      expect(filesParam?.type).toBe('array');
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing files', async () => {
      const result = await lspDiagnosticsTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Files parameter is required');
    });

    it('should return error for empty files array', async () => {
      const result = await lspDiagnosticsTool.execute({ files: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Files parameter is required');
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', () => {
      const tool = lspDiagnosticsTool as any;
      expect(tool.detectLanguage('test.ts')).toBe('typescript');
      expect(tool.detectLanguage('component.tsx')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      const tool = lspDiagnosticsTool as any;
      expect(tool.detectLanguage('script.js')).toBe('javascript');
      expect(tool.detectLanguage('app.jsx')).toBe('javascript');
    });

    it('should detect Python files', () => {
      const tool = lspDiagnosticsTool as any;
      expect(tool.detectLanguage('script.py')).toBe('python');
    });

    it('should detect JSON files', () => {
      const tool = lspDiagnosticsTool as any;
      expect(tool.detectLanguage('config.json')).toBe('json');
    });
  });

  describe('diagnostic analysis', () => {
    it('should analyze JavaScript code for console.log statements', () => {
      const tool = lspDiagnosticsTool as any;
      const content = 'console.log("debug");\nconsole.log("info");';
      const diagnostics = tool.analyzeJavaScript(content, 'test.js');

      const consoleDiagnostics = diagnostics.filter((d: any) => d.message.includes('console.log'));
      expect(consoleDiagnostics.length).toBeGreaterThan(0);
    });

    it('should analyze JSON for syntax errors', () => {
      const tool = lspDiagnosticsTool as any;
      const content = '{"name": "test", "value": }'; // Invalid JSON
      const diagnostics = tool.analyzeJSON(content, 'test.json');

      const errorDiagnostics = diagnostics.filter((d: any) => d.severity === 'error');
      expect(errorDiagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('diagnostic filtering', () => {
    it('should filter diagnostics by severity', () => {
      const tool = lspDiagnosticsTool as any;
      const diagnostics = [
        { severity: 'error', message: 'Error 1' },
        { severity: 'warning', message: 'Warning 1' },
        { severity: 'information', message: 'Info 1' },
      ];

      const errorsOnly = tool.filterDiagnosticsBySeverity(diagnostics, 'error');
      expect(errorsOnly.length).toBe(1);
      expect(errorsOnly[0].severity).toBe('error');
    });
  });
});
