/**
 * Python 3 harness. Same protocol as Java: "---TC_<id>---" markers, "@@RESULT@@<value>",
 * "@@ERROR@@<type>@@<line>@@<message>". Each test runs in its own try/except, and the
 * student's line number is recovered from the traceback.
 */
const PREAMBLE = `import sys, math, heapq, bisect, itertools, functools, collections, string, re
from typing import *
from collections import deque, defaultdict, Counter, OrderedDict
sys.setrecursionlimit(5000)

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# ---- student code ----`;

function helpers(userStart, userEnd) {
  return `# ---- DebugTrack harness ----
import traceback as _dt_tb
_DT_START, _DT_END = ${userStart}, ${userEnd}

def _dt_fmt(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        return '"' + v + '"'
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(_dt_fmt(x) for x in v) + "]"
    if hasattr(v, "val") and hasattr(v, "next"):
        out, n, guard = [], v, 0
        while n is not None and guard < 10000:
            out.append(str(n.val)); n = n.next; guard += 1
        return "[" + ", ".join(out) + "]"
    return str(v)

def _dt_list(vals):
    dummy = ListNode(0); tail = dummy
    for x in vals:
        tail.next = ListNode(x); tail = tail.next
    return dummy.next

def _dt_tree(vals):
    if not vals or vals[0] is None:
        return None
    root = TreeNode(vals[0]); q = deque([root]); i = 1
    while q and i < len(vals):
        n = q.popleft()
        if i < len(vals) and vals[i] is not None:
            n.left = TreeNode(vals[i]); q.append(n.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            n.right = TreeNode(vals[i]); q.append(n.right)
        i += 1
    return root

def _dt_out(v):
    print("@@RESULT@@" + _dt_fmt(v), flush=True)

def _dt_out_list(head):
    out, n, guard = [], head, 0
    while n is not None and guard < 10000:
        out.append(str(n.val)); n = n.next; guard += 1
    print("@@RESULT@@[" + ", ".join(out) + "]", flush=True)

def _dt_run(tid, fn):
    print("---TC_%d---" % tid, flush=True)
    try:
        fn()
    except BaseException as e:
        if isinstance(e, KeyboardInterrupt):
            raise
        line = -1
        for fr in _dt_tb.extract_tb(e.__traceback__):
            if fr.filename.endswith("script.py") and _DT_START <= fr.lineno <= _DT_END:
                line = fr.lineno - _DT_START + 1
        msg = str(e).replace("\\n", " ")[:300]
        print("@@ERROR@@" + type(e).__name__ + "@@" + str(line) + "@@" + msg, flush=True)
`;
}

/** Python literal for a JSON-like value. */
function lit(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  return String(v);
}

function argExpr(value, type) {
  if (type === 'ListNode') return `_dt_list(${lit(value)})`;
  if (type === 'TreeNode') return `_dt_tree(${lit(value)})`;
  if (type === 'char[][]') return `[list(r) for r in ${lit(value)}]`;
  return lit(value);
}

function buildHarness(code, tests, sig) {
  const userLines = code.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const pre = PREAMBLE.split('\n');
  const userStart = pre.length + 1;
  const userEnd = userStart + userLines.length - 1;

  const body = tests.map((tc) => {
    const decls = sig.params.map(([, type], i) => `    a${i} = ${argExpr(tc.args[i], type)}`);
    const call = `Solution().${sig.method}(${sig.params.map((_, i) => `a${i}`).join(', ')})`;
    const printer = sig.returns === 'ListNode' ? '_dt_out_list' : '_dt_out';
    const printLine = sig.inplace !== undefined ? `    ${call}\n    _dt_out(a${sig.inplace})` : `    ${printer}(${call})`;
    return `def _dt_t${tc.id}():\n${decls.join('\n')}\n${printLine}\n_dt_run(${tc.id}, _dt_t${tc.id})`;
  }).join('\n\n');

  const source = [...pre, ...userLines, '', helpers(userStart, userEnd), body, ''].join('\n');
  return { source, userStart, userEnd };
}

const PY_TYPES = {
  int: 'int', boolean: 'bool', String: 'str', 'int[]': 'List[int]', 'int[][]': 'List[List[int]]',
  'String[]': 'List[str]', 'char[][]': 'List[List[str]]', ListNode: 'Optional[ListNode]',
  TreeNode: 'Optional[TreeNode]', 'List<List<Integer>>': 'List[List[int]]', void: 'None'
};
const PY_DEFAULTS = { int: '0', boolean: 'False', String: '""', 'int[]': '[]', 'int[][]': '[]', ListNode: 'None', TreeNode: 'None', 'List<List<Integer>>': '[]' };

function starter(problem) {
  const sig = problem.signature;
  const usesList = sig.params.some(([, t]) => t === 'ListNode') || sig.returns === 'ListNode';
  const usesTree = sig.params.some(([, t]) => t === 'TreeNode');
  const header = [];
  if (usesList) header.push('# Definition for singly-linked list (provided by DebugTrack):', '# class ListNode:', '#     def __init__(self, val=0, next=None):', '#         self.val = val', '#         self.next = next', '');
  if (usesTree) header.push('# Definition for a binary tree node (provided by DebugTrack):', '# class TreeNode:', '#     def __init__(self, val=0, left=None, right=None):', '#         self.val = val', '#         self.left = left', '#         self.right = right', '');
  const params = sig.params.map(([n, t]) => `${n}: ${PY_TYPES[t]}`).join(', ');
  const body = sig.returns === 'void'
    ? [`        # Modify ${sig.params[sig.inplace][0]} in place`, '        pass']
    : [`        return ${PY_DEFAULTS[sig.returns]}`];
  return [...header, 'class Solution:', `    def ${sig.method}(self, ${params}) -> ${PY_TYPES[sig.returns]}:`, ...body].join('\n');
}

/** Maps a Python exception to a language-neutral error kind. */
function errorKind(type, message) {
  const msg = message || '';
  if (type === 'IndexError') return /pop from (an )?empty|empty (list|deque)/.test(msg) ? 'empty-collection' : 'index';
  if ((type === 'AttributeError' || type === 'TypeError') && /NoneType/.test(msg)) return 'null';
  if (type === 'RecursionError') return 'stack-overflow';
  if (type === 'ZeroDivisionError') return 'arithmetic';
  return 'other';
}

/** Python has no compile step: syntax errors arrive as a traceback on stderr. */
function detectCompileError(judge, userStart, userEnd) {
  if (!/\b(SyntaxError|IndentationError|TabError)\b/.test(judge.stderr || '')) return null;
  return judge.stderr.replace(/File "[^"]*script\.py", line (\d+)/g, (m, n) => {
    const line = Number(n);
    return line >= userStart && line <= userEnd ? `Line ${line - userStart + 1}` : 'Test harness';
  }).trim();
}

module.exports = {
  id: 'python',
  label: 'Python 3.8',
  judgeId: Number(process.env.JUDGE0_PYTHON_ID || 71),
  monaco: 'python',
  sourceFile: 'script.py',
  buildHarness,
  errorKind,
  detectCompileError,
  starter
};
