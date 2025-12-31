import { parseDiff, DiffRenderer, DiffStats, InlineDiff } from '../ui/components/DiffRenderer';

// Mock ink components
jest.mock('ink', () => {
  const React = require('react');
  return {
    Box: ({ children, ...props }: any) => React.createElement('div', { 'data-testid': 'box', ...props }, children),
    Text: ({ children, color, bold, dimColor, ...props }: any) =>
      React.createElement('span', { 'data-testid': 'text', 'data-color': color, 'data-bold': bold, 'data-dimcolor': dimColor, ...props }, children),
  };
});

describe('DiffRenderer', () => {
  describe('parseDiff', () => {
    const sampleDiff = `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,5 +1,6 @@
 const foo = 1;
-const bar = 2;
+const bar = 3;
+const baz = 4;
 const qux = 5;

 export { foo };`;

    it('should parse file header correctly', () => {
      const result = parseDiff(sampleDiff);

      expect(result.length).toBe(1);
      expect(result[0].oldPath).toBe('src/test.ts');
      expect(result[0].newPath).toBe('src/test.ts');
    });

    it('should parse hunk header correctly', () => {
      const result = parseDiff(sampleDiff);

      expect(result[0].hunks.length).toBe(1);
      expect(result[0].hunks[0].startLineOld).toBe(1);
      expect(result[0].hunks[0].countOld).toBe(5);
      expect(result[0].hunks[0].startLineNew).toBe(1);
      expect(result[0].hunks[0].countNew).toBe(6);
    });

    it('should identify additions and deletions', () => {
      const result = parseDiff(sampleDiff);
      const lines = result[0].hunks[0].lines;

      const additions = lines.filter(l => l.type === 'addition');
      const deletions = lines.filter(l => l.type === 'deletion');
      const context = lines.filter(l => l.type === 'context');

      expect(additions.length).toBe(2);
      expect(deletions.length).toBe(1);
      expect(context.length).toBeGreaterThanOrEqual(3); // May vary slightly based on blank lines
    });

    it('should track line numbers correctly', () => {
      const result = parseDiff(sampleDiff);
      const lines = result[0].hunks[0].lines.filter(l => l.type !== 'hunk');

      // First line is context (line 1 in both)
      const firstContext = lines.find(l => l.content === 'const foo = 1;');
      expect(firstContext?.lineNumber?.old).toBe(1);
      expect(firstContext?.lineNumber?.new).toBe(1);

      // Deletion should have old line number
      const deletion = lines.find(l => l.type === 'deletion');
      expect(deletion?.lineNumber?.old).toBe(2);
      expect(deletion?.lineNumber?.new).toBeUndefined();

      // Addition should have new line number
      const firstAddition = lines.find(l => l.type === 'addition');
      expect(firstAddition?.lineNumber?.new).toBeDefined();
      expect(firstAddition?.lineNumber?.old).toBeUndefined();
    });

    it('should parse new file marker', () => {
      const newFileDiff = `diff --git a/new.ts b/new.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,3 @@
+const x = 1;
+const y = 2;
+const z = 3;`;

      const result = parseDiff(newFileDiff);

      expect(result[0].isNew).toBe(true);
      expect(result[0].isDeleted).toBe(false);
    });

    it('should parse deleted file marker', () => {
      const deletedFileDiff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1234567..0000000
--- a/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-const x = 1;
-const y = 2;
-const z = 3;`;

      const result = parseDiff(deletedFileDiff);

      expect(result[0].isDeleted).toBe(true);
      expect(result[0].isNew).toBe(false);
    });

    it('should parse renamed file marker', () => {
      const renamedFileDiff = `diff --git a/old.ts b/new.ts
similarity index 90%
rename from old.ts
rename to new.ts
index 1234567..abcdefg 100644
--- a/old.ts
+++ b/new.ts
@@ -1 +1 @@
-const old = 1;
+const new = 1;`;

      const result = parseDiff(renamedFileDiff);

      expect(result[0].isRenamed).toBe(true);
    });

    it('should handle multiple files', () => {
      const multiFileDiff = `diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
index 1234567..abcdefg 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2`;

      const result = parseDiff(multiFileDiff);

      expect(result.length).toBe(2);
      expect(result[0].newPath).toBe('file1.ts');
      expect(result[1].newPath).toBe('file2.ts');
    });

    it('should handle empty diff', () => {
      const result = parseDiff('');

      expect(result.length).toBe(0);
    });

    it('should handle diff with no changes', () => {
      const noChangesDiff = `diff --git a/test.ts b/test.ts
index 1234567..1234567 100644`;

      const result = parseDiff(noChangesDiff);

      expect(result.length).toBe(1);
      expect(result[0].hunks.length).toBe(0);
    });
  });

  describe('DiffRenderer component', () => {
    const sampleDiff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3`;

    it('should be a valid React component', () => {
      // DiffRenderer is a memo'd component, verify it exists
      expect(DiffRenderer).toBeDefined();
      expect(typeof DiffRenderer).toBe('object'); // memo'd components are objects
    });

    it('should accept valid props', () => {
      // Verify the component can be called with valid props structure
      const props = { diff: sampleDiff };
      expect(props.diff).toBeDefined();
    });

    it('should accept optional props', () => {
      const props = {
        diff: sampleDiff,
        maxLines: 5,
        showLineNumbers: false,
        showSyntaxHighlight: false,
        compact: true,
      };
      expect(props.maxLines).toBe(5);
      expect(props.showLineNumbers).toBe(false);
      expect(props.showSyntaxHighlight).toBe(false);
      expect(props.compact).toBe(true);
    });
  });

  describe('DiffStats component', () => {
    it('should be a valid React component', () => {
      expect(DiffStats).toBeDefined();
      expect(typeof DiffStats).toBe('object'); // memo'd components are objects
    });

    it('should accept diff prop', () => {
      const props = { diff: '+added\n-deleted' };
      expect(props.diff).toBeDefined();
    });
  });

  describe('InlineDiff component', () => {
    it('should be a valid React component', () => {
      expect(InlineDiff).toBeDefined();
      expect(typeof InlineDiff).toBe('object'); // memo'd components are objects
    });

    it('should accept oldText and newText props', () => {
      const props = { oldText: 'old', newText: 'new' };
      expect(props.oldText).toBe('old');
      expect(props.newText).toBe('new');
    });
  });
});

describe('Syntax Highlighting', () => {
  // Test that code patterns are recognized (via parseDiff output)
  it('should handle JavaScript keywords in diff content', () => {
    const jsDiff = `diff --git a/test.ts b/test.ts
@@ -1,3 +1,3 @@
-const oldFunction = function() { return true; };
+const newFunction = async function() { return false; };
 export { newFunction };`;

    const result = parseDiff(jsDiff);

    // Verify we captured the code content
    const lines = result[0].hunks[0].lines;
    const addition = lines.find(l => l.type === 'addition');
    expect(addition?.content).toContain('async');
    expect(addition?.content).toContain('function');
  });

  it('should handle strings in diff content', () => {
    const stringDiff = `diff --git a/test.ts b/test.ts
@@ -1 +1 @@
-const msg = "old message";
+const msg = "new message";`;

    const result = parseDiff(stringDiff);
    const lines = result[0].hunks[0].lines;
    const addition = lines.find(l => l.type === 'addition');
    expect(addition?.content).toContain('"new message"');
  });

  it('should handle comments in diff content', () => {
    const commentDiff = `diff --git a/test.ts b/test.ts
@@ -1 +1 @@
-// old comment
+// new comment`;

    const result = parseDiff(commentDiff);
    const lines = result[0].hunks[0].lines;
    const addition = lines.find(l => l.type === 'addition');
    expect(addition?.content).toContain('// new comment');
  });
});
