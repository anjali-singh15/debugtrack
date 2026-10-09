/**
 * Language-neutral method signatures for every problem.
 *
 * Test cases in problems.js are authored (and verified) as Java calls. For Python and C++,
 * the argument VALUES are extracted from those Java calls (parseJavaCall) and re-emitted in
 * the target language from these signatures, so all languages share exactly the same tests.
 *
 * Types: int, boolean, String, int[], int[][], String[], char[][] (grid), ListNode, TreeNode,
 *        List<List<Integer>> (return only), void (in-place: the `inplace` parameter is printed).
 */
const S = (method, params, returns, inplace) => ({ method, params, returns, inplace });

const SIGNATURES = {
  'two-sum': S('twoSum', [['nums', 'int[]'], ['target', 'int']], 'int[]'),
  'move-zeroes': S('moveZeroes', [['nums', 'int[]']], 'void', 0),
  'merge-sorted-array': S('merge', [['nums1', 'int[]'], ['m', 'int'], ['nums2', 'int[]'], ['n', 'int']], 'void', 0),
  'container-with-most-water': S('maxArea', [['height', 'int[]']], 'int'),
  'maximum-subarray': S('maxSubArray', [['nums', 'int[]']], 'int'),
  'trapping-rain-water': S('trap', [['height', 'int[]']], 'int'),
  'running-sum': S('runningSum', [['nums', 'int[]']], 'int[]'),
  'rotate-array': S('rotate', [['nums', 'int[]'], ['k', 'int']], 'void', 0),
  'longest-substring': S('lengthOfLongestSubstring', [['s', 'String']], 'int'),
  'reverse-words': S('reverseWords', [['s', 'String']], 'String'),
  'valid-palindrome': S('isPalindrome', [['s', 'String']], 'boolean'),
  'valid-anagram': S('isAnagram', [['s', 'String'], ['t', 'String']], 'boolean'),
  'first-unique-char': S('firstUniqChar', [['s', 'String']], 'int'),
  'longest-consecutive': S('longestConsecutive', [['nums', 'int[]']], 'int'),
  'binary-search': S('search', [['nums', 'int[]'], ['target', 'int']], 'int'),
  'search-insert': S('searchInsert', [['nums', 'int[]'], ['target', 'int']], 'int'),
  'first-last-position': S('searchRange', [['nums', 'int[]'], ['target', 'int']], 'int[]'),
  'sort-colors': S('sortColors', [['nums', 'int[]']], 'void', 0),
  'merge-intervals': S('merge', [['intervals', 'int[][]']], 'int[][]'),
  'reverse-linked-list': S('reverseList', [['head', 'ListNode']], 'ListNode'),
  'middle-of-list': S('middleNode', [['head', 'ListNode']], 'ListNode'),
  'merge-two-lists': S('mergeTwoLists', [['a', 'ListNode'], ['b', 'ListNode']], 'ListNode'),
  'remove-nth-from-end': S('removeNthFromEnd', [['head', 'ListNode'], ['n', 'int']], 'ListNode'),
  'valid-parentheses': S('isValid', [['s', 'String']], 'boolean'),
  'daily-temperatures': S('dailyTemperatures', [['temps', 'int[]']], 'int[]'),
  'evaluate-postfix': S('evalRPN', [['tokens', 'String[]']], 'int'),
  'recent-requests': S('countRecent', [['times', 'int[]']], 'int[]'),
  'round-robin': S('finishOrder', [['burst', 'int[]'], ['quantum', 'int']], 'int[]'),
  'max-depth': S('maxDepth', [['root', 'TreeNode']], 'int'),
  'level-order': S('levelOrder', [['root', 'TreeNode']], 'List<List<Integer>>'),
  'path-sum': S('hasPathSum', [['root', 'TreeNode'], ['target', 'int']], 'boolean'),
  'number-of-islands': S('numIslands', [['grid', 'char[][]']], 'int'),
  'count-components': S('countComponents', [['n', 'int'], ['edges', 'int[][]']], 'int'),
  'shortest-path': S('fewestHops', [['n', 'int'], ['edges', 'int[][]'], ['start', 'int'], ['end', 'int']], 'int'),
  'climbing-stairs': S('climbStairs', [['n', 'int']], 'int'),
  'house-robber': S('rob', [['nums', 'int[]']], 'int'),
  'coin-change': S('coinChange', [['coins', 'int[]'], ['amount', 'int']], 'int')
};

// ------------------------------------------------------------------ Java call -> argument values

/** Splits on top-level commas, respecting quotes and (), [], {} nesting. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { cur += text[++i]; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Converts Java braces to JSON brackets outside of string literals. */
function bracesToBrackets(text) {
  let out = '', inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += text[++i]; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    out += c === '{' ? '[' : c === '}' ? ']' : c;
  }
  return out;
}

function parseJavaValue(expr) {
  const e = expr.trim();
  if (/^-?\d+$/.test(e)) return Number(e);
  if (e === 'true' || e === 'false') return e === 'true';
  if (e.startsWith('"')) return JSON.parse(e);
  if (e.startsWith('new ')) return JSON.parse(bracesToBrackets(e.slice(e.indexOf('{'))));
  if (e.startsWith('{')) return JSON.parse(bracesToBrackets(e));
  const helper = e.match(/^DT\.(list|tree|grid)\(([\s\S]*)\)$/);
  if (helper) return JSON.parse('[' + helper[2] + ']');
  throw new Error(`Cannot parse Java test argument: ${expr}`);
}

/** Extracts the text between `open` (at index start) and its matching ')' */
function matchParen(text, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error('Unbalanced parentheses in test call');
}

/** Returns the argument values of a Java test call, e.g. 'DT.out(sol.f(new int[]{1, 2}, 3));' -> [[1, 2], 3] */
function parseJavaCall(call, sig) {
  const idx = call.indexOf(`sol.${sig.method}(`);
  if (idx === -1) throw new Error(`Call does not invoke sol.${sig.method}: ${call}`);
  const argText = matchParen(call, idx + `sol.${sig.method}`.length);
  // In-place tests declare the array first: { int[] a = {...}; sol.f(a, ...); DT.out(a); }
  const local = call.match(/^\{\s*int\[\]\s+(\w+)\s*=\s*(\{[^}]*\})\s*;/);
  return splitTopLevel(argText).map((arg) =>
    local && arg === local[1] ? parseJavaValue(local[2]) : parseJavaValue(arg));
}

module.exports = { SIGNATURES, parseJavaCall, splitTopLevel };
