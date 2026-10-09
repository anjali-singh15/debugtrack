/**
 * Java (JDK 17) harness.
 *  - every test runs inside its own try/catch, so one exception does not hide the others,
 *    and the exception type + line become evidence for the mistake engine;
 *  - results are printed after "@@RESULT@@" so the student's own println output stays separate;
 *  - import lines are hoisted to the top and replaced by blank lines, so compiler/runtime
 *    line numbers map 1:1 back to the student's editor.
 * Java tests use the verified `call` snippets from data/problems.js directly.
 */
const BASE_IMPORTS = [
  'import java.util.*;',
  'import java.util.function.*;',
  'import java.util.stream.*;',
  'import java.io.*;'
];

const LIST_NODE_CLASS = `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`;

const TREE_NODE_CLASS = `class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}`;

function helperClass(userStart, userEnd) {
  return `final class DT {
    static final int USER_START = ${userStart}, USER_END = ${userEnd};
    static void emit(String s) { System.out.println("@@RESULT@@" + s); }
    static void out(Object o) { emit(fmt(o)); }
    static void outStr(String s) { emit(s == null ? "null" : "\\"" + s + "\\""); }
    static void outList(ListNode head) {
        StringBuilder sb = new StringBuilder("[");
        int guard = 0;
        for (ListNode n = head; n != null; n = n.next) {
            if (++guard > 10000) { sb.append(", ...(cycle detected)"); break; }
            if (sb.length() > 1) sb.append(", ");
            sb.append(n.val);
        }
        emit(sb.append("]").toString());
    }
    static String fmt(Object o) {
        if (o == null) return "null";
        if (o instanceof int[]) return Arrays.toString((int[]) o);
        if (o instanceof long[]) return Arrays.toString((long[]) o);
        if (o instanceof double[]) return Arrays.toString((double[]) o);
        if (o instanceof boolean[]) return Arrays.toString((boolean[]) o);
        if (o instanceof char[]) return Arrays.toString((char[]) o);
        if (o instanceof Object[]) return Arrays.deepToString((Object[]) o);
        return String.valueOf(o);
    }
    static ListNode list(int... values) {
        ListNode dummy = new ListNode(0), tail = dummy;
        for (int v : values) { tail.next = new ListNode(v); tail = tail.next; }
        return dummy.next;
    }
    static TreeNode tree(Integer... v) {
        if (v.length == 0 || v[0] == null) return null;
        TreeNode root = new TreeNode(v[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < v.length) {
            TreeNode n = q.poll();
            if (i < v.length && v[i] != null) { n.left = new TreeNode(v[i]); q.add(n.left); }
            i++;
            if (i < v.length && v[i] != null) { n.right = new TreeNode(v[i]); q.add(n.right); }
            i++;
        }
        return root;
    }
    static char[][] grid(String... rows) {
        char[][] g = new char[rows.length][];
        for (int i = 0; i < rows.length; i++) g[i] = rows[i].toCharArray();
        return g;
    }
    static void error(Throwable e) {
        int line = -1;
        for (StackTraceElement f : e.getStackTrace()) {
            if ("Main.java".equals(f.getFileName()) && f.getLineNumber() >= USER_START && f.getLineNumber() <= USER_END) {
                line = f.getLineNumber() - USER_START + 1;
                break;
            }
        }
        String msg = String.valueOf(e.getMessage()).replace('\\n', ' ').replace('\\r', ' ');
        if (msg.length() > 300) msg = msg.substring(0, 300) + "...";
        System.out.println("@@ERROR@@" + e.getClass().getName() + "@@" + line + "@@" + msg);
    }
}`;
}

/**
 * Prepares the student's code for inclusion in Main.java without changing line numbers.
 */
function prepareUserCode(code) {
  const imports = [];
  const lines = code.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    if (/^\s*import\s+[\w.*]+\s*;\s*$/.test(line)) {
      imports.push(line.trim());
      return '';
    }
    if (/^\s*package\s+[\w.]+\s*;\s*$/.test(line)) return '';
    // Only Main may be public inside Main.java
    return line.replace(/^(\s*)public\s+((?:final\s+|abstract\s+)?class\s+)/, '$1$2');
  });
  return { lines, imports };
}

function buildHarness(code, tests) {
  const { lines: userLines, imports } = prepareUserCode(code);
  // Starter templates describe ListNode/TreeNode in comments; only real definitions count
  const codeWithoutComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const definesListNode = /\bclass\s+ListNode\b/.test(codeWithoutComments);
  const definesTreeNode = /\bclass\s+TreeNode\b/.test(codeWithoutComments);

  const preamble = [...new Set([...BASE_IMPORTS, ...imports])];
  if (!definesListNode) preamble.push(...LIST_NODE_CLASS.split('\n'));
  if (!definesTreeNode) preamble.push(...TREE_NODE_CLASS.split('\n'));
  preamble.push('// ---- student code ----');

  const userStart = preamble.length + 1;
  const userEnd = userStart + userLines.length - 1;

  const mainBody = tests.map((tc) =>
    `        System.out.println("---TC_${tc.id}---");\n` +
    `        try { Solution sol = new Solution(); ${tc.call} } catch (Throwable e) { DT.error(e); }`
  ).join('\n');

  const source = [
    ...preamble,
    ...userLines,
    '// ---- DebugTrack harness ----',
    helperClass(userStart, userEnd),
    'public class Main {',
    '    public static void main(String[] args) {',
    mainBody,
    '        System.out.flush();',
    '    }',
    '}'
  ].join('\n');

  return { source, userStart, userEnd };
}


/** Maps a Java exception class name to a language-neutral error kind. */
function errorKind(type) {
  if (/IndexOutOfBoundsException$/.test(type)) return 'index';
  if (type === 'NullPointerException') return 'null';
  if (type === 'StackOverflowError') return 'stack-overflow';
  if (type === 'ArithmeticException') return 'arithmetic';
  if (type === 'EmptyStackException' || type === 'NoSuchElementException') return 'empty-collection';
  return 'other';
}

module.exports = {
  id: 'java',
  label: 'Java (JDK 17)',
  judgeId: Number(process.env.JUDGE0_JAVA_ID || 91),
  monaco: 'java',
  sourceFile: 'Main.java',
  buildHarness,
  errorKind,
  starter: (problem) => problem.starterCode
};
