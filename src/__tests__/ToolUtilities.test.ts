import { ToolUtilities } from '../tools/ToolUtilities';

describe('ToolUtilities', () => {
  describe('validateRequiredParams', () => {
    it('should return valid when all required params are present', () => {
      const result = ToolUtilities.validateRequiredParams({ name: 'test', value: 42 }, [
        'name',
        'value',
      ]);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return invalid when required params are missing', () => {
      const result = ToolUtilities.validateRequiredParams({ name: 'test' }, ['name', 'value']);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['value']);
    });
  });

  describe('validateParamTypes', () => {
    const paramDefs = [
      { name: 'count', type: 'number' as const, required: true },
      { name: 'enabled', type: 'boolean' as const, required: false },
    ];

    it('should validate correct types', () => {
      const result = ToolUtilities.validateParamTypes({ count: 5, enabled: true }, paramDefs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect type mismatches', () => {
      const result = ToolUtilities.validateParamTypes({ count: '5', enabled: true }, paramDefs);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Parameter 'count' should be of type 'number' but got 'string'"
      );
    });
  });

  describe('applyDefaults', () => {
    const paramDefs = [
      { name: 'timeout', type: 'number' as const, required: false, defaultValue: 5000 },
      { name: 'retries', type: 'number' as const, required: false, defaultValue: 3 },
    ];

    it('should apply default values when params are missing', () => {
      const result = ToolUtilities.applyDefaults({}, paramDefs);

      expect(result.timeout).toBe(5000);
      expect(result.retries).toBe(3);
    });

    it('should not override provided values', () => {
      const result = ToolUtilities.applyDefaults({ timeout: 10000 }, paramDefs);

      expect(result.timeout).toBe(10000);
      expect(result.retries).toBe(3);
    });
  });

  describe('sanitizePath', () => {
    it('should normalize paths', () => {
      const result = ToolUtilities.sanitizePath('./foo/../bar');
      expect(result).toBe('bar');
    });

    it('should prevent path traversal', () => {
      const result = ToolUtilities.sanitizePath('../../../etc/passwd');
      expect(result).toBe('etc/passwd');
    });

    it('should reject system directories', () => {
      expect(() => ToolUtilities.sanitizePath('/etc/passwd')).toThrow(
        'Access to system directories is not allowed'
      );
    });
  });

  describe('isPathSafe', () => {
    it('should accept safe paths', () => {
      expect(ToolUtilities.isPathSafe('src/main.ts')).toBe(true);
      expect(ToolUtilities.isPathSafe('data/input.json')).toBe(true);
    });

    it('should reject unsafe paths', () => {
      expect(ToolUtilities.isPathSafe('../../../etc/passwd')).toBe(false);
      expect(ToolUtilities.isPathSafe('file<with>brackets.txt')).toBe(false);
    });

    it('should enforce file extensions when specified', () => {
      expect(ToolUtilities.isPathSafe('test.js', ['.js', '.ts'])).toBe(true);
      expect(ToolUtilities.isPathSafe('test.py', ['.js', '.ts'])).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(ToolUtilities.formatFileSize(512)).toBe('512.0 B');
      expect(ToolUtilities.formatFileSize(1024)).toBe('1.0 KB');
      expect(ToolUtilities.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });
  });

  describe('createErrorResult and createSuccessResult', () => {
    it('should create proper error results', () => {
      const result = ToolUtilities.createErrorResult('Test error', { code: 500 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('code', 500);
    });

    it('should create proper success results', () => {
      const data = { result: 'success' };
      const result = ToolUtilities.createSuccessResult(data, { count: 10 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('count', 10);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = ToolUtilities.safeJsonParse('{"name": "test", "value": 42}');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 42 });
    });

    it('should handle invalid JSON', () => {
      const result = ToolUtilities.safeJsonParse('{invalid json}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('escapeShellArg', () => {
    it('should escape single quotes', () => {
      const result = ToolUtilities.escapeShellArg("it's a test");
      expect(result).toBe("'it'\"'\"'s a test'");
    });

    it('should handle normal strings', () => {
      const result = ToolUtilities.escapeShellArg('normal string');
      expect(result).toBe("'normal string'");
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = ToolUtilities.generateId('test');
      const id2 = ToolUtilities.generateId('test');

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(ToolUtilities.isValidUrl('https://example.com')).toBe(true);
      expect(ToolUtilities.isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(ToolUtilities.isValidUrl('not-a-url')).toBe(false);
      expect(ToolUtilities.isValidUrl('')).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract domains correctly', () => {
      expect(ToolUtilities.extractDomain('https://example.com/path')).toBe('example.com');
      expect(ToolUtilities.extractDomain('http://sub.example.com')).toBe('sub.example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(ToolUtilities.extractDomain('not-a-url')).toBe(null);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(ToolUtilities.formatDuration(500)).toBe('500ms');
      expect(ToolUtilities.formatDuration(1500)).toBe('1s');
      expect(ToolUtilities.formatDuration(65000)).toBe('1m 5s');
      expect(ToolUtilities.formatDuration(3665000)).toBe('1h 1m 5s');
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(ToolUtilities.deepClone(42)).toBe(42);
      expect(ToolUtilities.deepClone('test')).toBe('test');
      expect(ToolUtilities.deepClone(null)).toBe(null);
    });

    it('should clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = ToolUtilities.deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should clone arrays', () => {
      const original = [1, [2, 3], 4];
      const cloned = ToolUtilities.deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
    });
  });

  describe('deepEqual', () => {
    it('should compare primitive values', () => {
      expect(ToolUtilities.deepEqual(42, 42)).toBe(true);
      expect(ToolUtilities.deepEqual(42, 43)).toBe(false);
      expect(ToolUtilities.deepEqual('test', 'test')).toBe(true);
    });

    it('should compare objects', () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { a: 1, b: { c: 2 } };
      const obj3 = { a: 1, b: { c: 3 } };

      expect(ToolUtilities.deepEqual(obj1, obj2)).toBe(true);
      expect(ToolUtilities.deepEqual(obj1, obj3)).toBe(false);
    });

    it('should compare arrays', () => {
      expect(ToolUtilities.deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(ToolUtilities.deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });
  });
});
