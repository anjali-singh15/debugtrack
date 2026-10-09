/**
 * C++ (GCC) harness. Same output protocol as Java/Python.
 *  - _GLIBCXX_DEBUG turns out-of-range vector/string indexing (normally silent undefined
 *    behaviour) into an abort with a precise message, which becomes Array Indexing evidence;
 *  - each test runs in a forked child process, so a crash (segfault, abort) only affects
 *    that test; the parent reports the signal with "@@CRASH@@<signal>".
 */
const PREAMBLE = `#define _GLIBCXX_DEBUG
#include <bits/stdc++.h>
#include <unistd.h>
#include <sys/wait.h>
using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *n) : val(x), next(n) {}
};

struct TreeNode {
    int val;
    TreeNode *left, *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *l, TreeNode *r) : val(x), left(l), right(r) {}
};

// ---- student code ----`;

const HELPERS = `// ---- DebugTrack harness ----
namespace dt {
const int NIL = INT_MIN;
string fmt(int v) { return to_string(v); }
string fmt(long long v) { return to_string(v); }
string fmt(bool v) { return v ? "true" : "false"; }
string fmt(char c) { return string(1, c); }
string fmt(const string& s) { return "\\"" + s + "\\""; }
string fmt(ListNode* h) {
    string s = "[";
    int guard = 0;
    for (ListNode* n = h; n != nullptr && guard < 10000; n = n->next, guard++) {
        if (s.size() > 1) s += ", ";
        s += to_string(n->val);
    }
    return s + "]";
}
template <class T> string fmt(const vector<T>& v) {
    string s = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) s += ", "; s += fmt(v[i]); }
    return s + "]";
}
ListNode* list(const vector<int>& v) {
    ListNode dummy; ListNode* t = &dummy;
    for (int x : v) { t->next = new ListNode(x); t = t->next; }
    return dummy.next;
}
TreeNode* tree(const vector<int>& v) {
    if (v.empty() || v[0] == NIL) return nullptr;
    TreeNode* root = new TreeNode(v[0]);
    queue<TreeNode*> q; q.push(root);
    size_t i = 1;
    while (!q.empty() && i < v.size()) {
        TreeNode* n = q.front(); q.pop();
        if (i < v.size() && v[i] != NIL) { n->left = new TreeNode(v[i]); q.push(n->left); }
        i++;
        if (i < v.size() && v[i] != NIL) { n->right = new TreeNode(v[i]); q.push(n->right); }
        i++;
    }
    return root;
}
vector<vector<char>> grid(const vector<string>& rows) {
    vector<vector<char>> g;
    for (const string& r : rows) g.push_back(vector<char>(r.begin(), r.end()));
    return g;
}
void out(const string& s) { cout << "@@RESULT@@" << s << endl; }
template <class F> void run(int id, F f) {
    cout << "---TC_" << id << "---" << endl;
    pid_t pid = fork();
    if (pid == 0) {
        dup2(1, 2);
        try { f(); }
        catch (const out_of_range& e) { cout << "@@ERROR@@std::out_of_range@@-1@@" << e.what() << endl; }
        catch (const exception& e) { cout << "@@ERROR@@std::exception@@-1@@" << e.what() << endl; }
        catch (...) { cout << "@@ERROR@@unknown exception@@-1@@" << endl; }
        cout.flush();
        _exit(0);
    }
    if (pid < 0) { f(); return; }
    int status = 0;
    waitpid(pid, &status, 0);
    if (WIFSIGNALED(status)) cout << "@@CRASH@@" << WTERMSIG(status) << endl;
}
}
`;

const CPP_PARAM = {
  int: 'int', boolean: 'bool', String: 'string', 'int[]': 'vector<int>&', 'int[][]': 'vector<vector<int>>&',
  'String[]': 'vector<string>&', 'char[][]': 'vector<vector<char>>&', ListNode: 'ListNode*', TreeNode: 'TreeNode*'
};
const CPP_RETURN = {
  int: 'int', boolean: 'bool', String: 'string', 'int[]': 'vector<int>', 'int[][]': 'vector<vector<int>>',
  ListNode: 'ListNode*', 'List<List<Integer>>': 'vector<vector<int>>', void: 'void'
};
const CPP_DEFAULT = { int: '0', boolean: 'false', String: '""', 'int[]': '{}', 'int[][]': '{}', ListNode: 'nullptr', 'List<List<Integer>>': '{}' };

/** C++ brace-initialiser literal for a JSON-like value. */
function lit(v) {
  if (v === null) return 'dt::NIL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '{' + v.map(lit).join(', ') + '}';
  return String(v);
}

function declaration(name, value, type) {
  switch (type) {
    case 'int': return `int ${name} = ${value};`;
    case 'boolean': return `bool ${name} = ${value};`;
    case 'String': return `string ${name} = ${JSON.stringify(value)};`;
    case 'int[]': return `vector<int> ${name} = ${lit(value)};`;
    case 'int[][]': return `vector<vector<int>> ${name} = ${lit(value)};`;
    case 'String[]': return `vector<string> ${name} = ${lit(value)};`;
    case 'char[][]': return `vector<vector<char>> ${name} = dt::grid(${lit(value)});`;
    case 'ListNode': return `ListNode* ${name} = dt::list(${lit(value)});`;
    case 'TreeNode': return `TreeNode* ${name} = dt::tree(${lit(value)});`;
    default: throw new Error(`Unsupported C++ parameter type ${type}`);
  }
}

function buildHarness(code, tests, sig) {
  const userLines = code.replace(/\r\n?/g, '\n').split('\n');
  const pre = PREAMBLE.split('\n');
  const userStart = pre.length + 1;
  const userEnd = userStart + userLines.length - 1;

  const calls = tests.map((tc) => {
    const decls = sig.params.map(([, type], i) => declaration(`a${i}`, tc.args[i], type)).join(' ');
    const call = `sol.${sig.method}(${sig.params.map((_, i) => `a${i}`).join(', ')})`;
    const print = sig.inplace !== undefined ? `${call}; dt::out(dt::fmt(a${sig.inplace}));` : `dt::out(dt::fmt(${call}));`;
    return `    dt::run(${tc.id}, [&]() { Solution sol; ${decls} ${print} });`;
  }).join('\n');

  const source = [...pre, ...userLines, '', HELPERS, 'int main() {', calls, '    return 0;', '}', ''].join('\n');
  return { source, userStart, userEnd };
}

function starter(problem) {
  const sig = problem.signature;
  const usesList = sig.params.some(([, t]) => t === 'ListNode') || sig.returns === 'ListNode';
  const usesTree = sig.params.some(([, t]) => t === 'TreeNode');
  const header = [];
  if (usesList) header.push('/*', ' * Definition for singly-linked list (provided by DebugTrack):', ' * struct ListNode {', ' *     int val;', ' *     ListNode *next;', ' *     ListNode(int x) : val(x), next(nullptr) {}', ' * };', ' */');
  if (usesTree) header.push('/*', ' * Definition for a binary tree node (provided by DebugTrack):', ' * struct TreeNode {', ' *     int val;', ' *     TreeNode *left, *right;', ' *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}', ' * };', ' */');
  const params = sig.params.map(([n, t]) => `${CPP_PARAM[t]} ${n}`).join(', ');
  const body = sig.returns === 'void'
    ? [`        // Modify ${sig.params[sig.inplace][0]} in place`]
    : [`        return ${CPP_DEFAULT[sig.returns]};`];
  return [...header, 'class Solution {', 'public:', `    ${CPP_RETURN[sig.returns]} ${sig.method}(${params}) {`, ...body, '    }', '};'].join('\n');
}

const SIGNALS = { 6: 'Aborted (SIGABRT)', 8: 'Floating-point exception (SIGFPE)', 11: 'Segmentation fault (SIGSEGV)', 9: 'Killed (SIGKILL)' };

/**
 * Turns a crashed child's output into an error. GCC debug-mode messages ("attempt to subscript
 * container with out-of-bounds index 5, but container only holds 3 elements") are extracted
 * from the student's stdout block and become the error message.
 */
function crashError(signal, stdoutLines) {
  const text = stdoutLines.join(' ').replace(/\s+/g, ' ');
  const debugStart = stdoutLines.findIndex((l) => /\/debug\/|In function:|^\/usr\//.test(l) || /Assertion .* failed/.test(l));
  const cleanStdout = debugStart >= 0 ? stdoutLines.slice(0, debugStart) : stdoutLines;
  const errorSentence = (text.match(/Error: ([^.]*\.)/) || text.match(/(Assertion '[^']*' failed\.)/) || [])[1];
  let kind = 'other';
  if (/out-of-bounds|subscript|__pos <= size\(\)|__n < this->size\(\)|__n < size\(\)/.test(text)) kind = 'index';
  else if (/empty container|empty\(\)/.test(text)) kind = 'empty-collection';
  else if (signal === 8) kind = 'arithmetic';
  else if (signal === 11) kind = 'segfault';
  return {
    error: { type: SIGNALS[signal] || `Signal ${signal}`, kind, line: null, message: errorSentence || '' },
    stdout: cleanStdout
  };
}

/** Maps a caught C++ exception to a language-neutral error kind. */
function errorKind(type) {
  return type === 'std::out_of_range' ? 'index' : 'other';
}

module.exports = {
  id: 'cpp',
  label: 'C++ (GCC 9.2)',
  judgeId: Number(process.env.JUDGE0_CPP_ID || 54),
  monaco: 'cpp',
  sourceFile: 'main.cpp',
  buildHarness,
  errorKind,
  crashError,
  starter
};
