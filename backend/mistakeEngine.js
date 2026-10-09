/**
 * DebugTrack - Explainable Rule-Based Mistake Detection Engine
 *
 * No AI / ML / external APIs. Every classification is produced by a named rule
 * that inspects concrete evidence:
 *   1. the exception type, message and line reported by the Judge0 harness,
 *   2. which test cases failed (and whether they are labelled edge cases),
 *   3. the shape of wrong outputs (e.g. off by exactly one),
 *   4. simple, explainable code patterns (e.g. `i <= arr.length`, `range(len(a) + 1)`).
 *
 * Works for Java, Python and C++: harnesses report a language-neutral error `kind`
 * (index, null, stack-overflow, arithmetic, empty-collection, segfault, other).
 *
 * Confidence:
 *   'high'     - direct evidence (an exception, or failures restricted to edge cases)
 *   'possible' - circumstantial evidence; the UI labels these "Possible mistake"
 * When evidence is insufficient the result is 'Unclassified' with a general suggestion.
 */

const CATEGORIES = ['Array Indexing', 'Null Handling', 'Loop Logic', 'Boundary Conditions', 'Runtime Errors', 'Unclassified'];

const CATEGORY_INFO = {
  'Array Indexing': {
    practiceTopic: 'Arrays',
    color: '#f43f5e',
    icon: 'fa-solid fa-layer-group',
    description: 'Reading or writing an index outside [0, length - 1]: off-by-one loop bounds, i + 1 / i - 1 look-ups, or sizing arrays one too small.',
    tip: 'Loop with i < arr.length, and guard look-ups such as arr[i + 1] or arr[i - 1] at the ends of the range.'
  },
  'Null Handling': {
    practiceTopic: 'Linked List',
    color: '#8b5cf6',
    icon: 'fa-solid fa-shield-halved',
    description: 'Dereferencing a reference that can be null: empty lists or trees, missing children, or node.next at the end of a list.',
    tip: 'Add guard clauses (if (head == null) ...) before reading .next, .left, .right or .val.'
  },
  'Loop Logic': {
    practiceTopic: 'Searching',
    color: '#f59e0b',
    icon: 'fa-solid fa-repeat',
    description: 'Loops that never terminate, run one time too many or too few, or update the wrong variable.',
    tip: 'Before coding a loop, write down its start, its exit condition and the variable that moves toward that exit.'
  },
  'Boundary Conditions': {
    practiceTopic: 'Searching',
    color: '#06b6d4',
    icon: 'fa-solid fa-arrows-left-right-to-line',
    description: 'Logic that works for typical inputs but fails at the extremes: empty input, a single element, duplicates or values at the very ends.',
    tip: 'Test your solution by hand on the smallest inputs (empty, one element, two elements) before submitting.'
  },
  'Runtime Errors': {
    practiceTopic: 'Stack',
    color: '#ef4444',
    icon: 'fa-solid fa-triangle-exclamation',
    description: 'Other exceptions that crash the program: division by zero, stack overflow from recursion, popping an empty stack, parsing errors.',
    tip: 'Check recursion base cases, divisors and isEmpty() before pop/poll operations.'
  },
  Unclassified: {
    practiceTopic: null,
    color: '#64748b',
    icon: 'fa-solid fa-circle-question',
    description: 'Failures where the available evidence is not strong enough to name a specific pattern.',
    tip: 'Trace the failing input by hand and print intermediate values to find where your logic diverges.'
  }
};

// Human-readable rule catalogue, shown on the Mistake Patterns page.
const RULES = [
  { id: 'AI-01', category: 'Array Indexing', confidence: 'high', trigger: 'Java IndexOutOfBoundsException · Python IndexError · C++ out-of-bounds subscript (debug-mode check) or std::out_of_range', explanation: 'The program accessed an index outside the valid range. The exception message gives the index and length, and the stack trace gives the line.' },
  { id: 'AI-02', category: 'Array Indexing', confidence: 'supporting', trigger: 'Loop bound such as i <= arr.length / s.size() / range(len(a) + 1)', explanation: 'Used as supporting evidence: a <= bound on a length visits one index past the end.' },
  { id: 'NH-01', category: 'Null Handling', confidence: 'high', trigger: 'Java NullPointerException · Python AttributeError/TypeError on None', explanation: 'A null reference was dereferenced. Often caused by empty input or reaching the end of a list/tree.' },
  { id: 'NH-02', category: 'Null Handling', confidence: 'possible', trigger: 'C++ segmentation fault on a linked-list / tree problem', explanation: 'Usually a nullptr dereference (e.g. node->next when node is nullptr), but a segfault can also come from deep recursion, so it is reported as possible.' },
  { id: 'AI-03', category: 'Array Indexing', confidence: 'possible', trigger: 'C++ segmentation fault on an array / string / grid problem', explanation: 'Usually an invalid index on a raw array or pointer, but other memory errors are possible.' },
  { id: 'LL-01', category: 'Loop Logic', confidence: 'high', trigger: 'Time Limit Exceeded and a while-loop whose condition variables are never modified in its body', explanation: 'The loop can never reach its exit condition.' },
  { id: 'LL-02', category: 'Loop Logic', confidence: 'possible', trigger: 'Time Limit Exceeded without a provably stuck loop', explanation: 'Either a loop does not terminate or the algorithm is too slow for the input size. Reported as a possible mistake.' },
  { id: 'LL-03', category: 'Loop Logic', confidence: 'possible', trigger: 'Wrong Answer where every wrong numeric output is off by exactly 1, or a wrong list output has exactly one element too many/few', explanation: 'Typical of a loop that runs one iteration too many or too few. Reported as a possible mistake.' },
  { id: 'BC-01', category: 'Boundary Conditions', confidence: 'high', trigger: 'Every failing test is a labelled edge case (empty, single element, extremes) while regular tests pass', explanation: 'The core logic works, but the extremes of the input range are not handled.' },
  { id: 'RE-01', category: 'Runtime Errors', confidence: 'high', trigger: 'Java StackOverflowError · Python RecursionError', explanation: 'Recursion did not reach a base case (or recursed far too deep).' },
  { id: 'RE-02', category: 'Runtime Errors', confidence: 'high', trigger: 'ArithmeticException · ZeroDivisionError · SIGFPE (e.g. division by zero)', explanation: 'An arithmetic operation was invalid for the given input.' },
  { id: 'RE-03', category: 'Runtime Errors', confidence: 'high', trigger: 'EmptyStackException / NoSuchElementException · Python pop from empty list/deque · C++ empty-container check', explanation: 'An element was removed from an empty stack, queue or iterator.' },
  { id: 'RE-04', category: 'Runtime Errors', confidence: 'high', trigger: 'Any other exception or abnormal termination', explanation: 'The exception name, message and line are reported as evidence.' },
  { id: 'UC-01', category: 'Unclassified', confidence: 'n/a', trigger: 'Wrong Answer with no rule above matching', explanation: 'DebugTrack does not guess. It reports the failing test and a general debugging suggestion.' },
  { id: 'CE-01', category: '(not counted)', confidence: 'n/a', trigger: 'Compilation Error', explanation: 'Syntax/type errors are reported with mapped line numbers but are not counted as logic mistake patterns.' }
];

// ------------------------------------------------------------------ helpers

function lineAt(code, n) {
  if (!n) return null;
  const l = (code.split('\n')[n - 1] || '').trim();
  return l || null;
}

function describeTest(t) {
  return `test #${t.id}${t.hidden ? ' (hidden)' : ''}${t.edge ? ` [${t.edge}]` : ''}`;
}

/** Finds loop conditions like `i <= nums.length` (AI-02). */
function findLengthInclusiveBounds(code) {
  const hits = [];
  code.split('\n').forEach((text, idx) => {
    const javaCpp = /\b(for|while)\b/.test(text) && /<=\s*(\(\s*\w+\s*\)\s*)?[\w.\[\]]+\.(length\b(?!\s*\(\))|length\(\)|size\(\))(?!\s*-)/.test(text);
    const python = /\bwhile\b.*<=\s*len\(/.test(text) || /\brange\([^)]*len\([^)]*\)\s*\+\s*1\s*\)/.test(text);
    if (javaCpp || python) {
      hits.push({ line: idx + 1, text: text.trim() });
    }
  });
  return hits;
}

const CONDITION_KEYWORDS = ['true', 'false', 'null', 'length', 'int', 'new', 'None', 'True', 'False', 'and', 'or', 'not', 'is', 'in', 'len', 'nullptr', 'NULL', 'size'];

function isMutated(v, body) {
  return new RegExp(`(\\+\\+|--)\\s*${v}\\b|\\b${v}\\s*(\\+\\+|--|[+\\-*/%]?=(?!=))|\\b${v}\\s*(\\.|->)\\s*\\w+\\s*\\(`).test(body) ||
    // tuple / multiple assignment, e.g. "a, b = b, a + b"
    body.split('\n').some((l) => /^[^=]*\b(\w+)\b[^=]*,[^=]*=(?!=)/.test(l) && new RegExp(`^[^=]*\\b${v}\\b[^=]*=(?!=)`).test(l));
}

function conditionVars(cond) {
  return [...new Set((cond.match(/(?<![.\w>])[A-Za-z_]\w*(?!\s*\()/g) || [])
    .filter((v) => !CONDITION_KEYWORDS.includes(v)))];
}

/** Python: `while cond:` loops whose body (the more-indented lines) never changes the condition variables. */
function findStuckPythonWhileLoops(code) {
  const stuck = [];
  const lines = code.split('\n');
  lines.forEach((text, idx) => {
    const m = text.match(/^(\s*)while\s+(.+):\s*(#.*)?$/);
    if (!m) return;
    const indent = m[1].length;
    const body = [];
    for (let k = idx + 1; k < lines.length; k++) {
      if (!lines[k].trim()) continue;
      if (lines[k].match(/^\s*/)[0].length <= indent) break;
      body.push(lines[k]);
    }
    const vars = conditionVars(m[2]);
    if (vars.length && !vars.some((v) => isMutated(v, body.join('\n')))) {
      stuck.push({ line: idx + 1, condition: m[2].trim(), vars });
    }
  });
  return stuck;
}

/** Finds `while (cond)` loops whose condition variables are never modified in the body (LL-01). */
function findStuckWhileLoops(code) {
  if (!/while\s*\(/.test(code) && /^\s*while\s+.+:/m.test(code)) return findStuckPythonWhileLoops(code);
  const stuck = [];
  const re = /while\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    // extract the condition with paren matching
    let depth = 1, i = m.index + m[0].length;
    const condStart = i;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    const cond = code.slice(condStart, i - 1);
    // extract the body
    let j = i;
    while (j < code.length && /\s/.test(code[j])) j++;
    let body;
    if (code[j] === '{') {
      let d = 1, k = j + 1;
      while (k < code.length && d > 0) {
        if (code[k] === '{') d++;
        else if (code[k] === '}') d--;
        k++;
      }
      body = code.slice(j + 1, k - 1);
    } else {
      body = code.slice(j, code.indexOf(';', j) + 1);
    }
    // (A conditional return/break inside does not help: this check only runs after a real time-out.)
    // Variables in the condition (ignore method calls like isEmpty(), and field access after a dot)
    const vars = conditionVars(cond);
    if (!vars.length) continue;
    // A method call on a condition variable (e.g. q.poll(), stack.pop()) may mutate it
    if (!vars.some((v) => isMutated(v, body))) {
      const line = code.slice(0, m.index).split('\n').length;
      stuck.push({ line, condition: cond.trim(), vars });
    }
  }
  return stuck;
}

/** Detects a method that calls itself more than once (exponential recursion without memoisation). */
function findBranchingRecursion(code) {
  const methods = [
    ...[...code.matchAll(/\b[\w<>\[\]*&:]+\s+(\w+)\s*\([^)]*\)\s*\{/g)].map((x) => x[1]),
    ...[...code.matchAll(/\bdef\s+(\w+)\s*\(/g)].map((x) => x[1])
  ];
  for (const name of new Set(methods)) {
    if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) continue;
    const calls = (code.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length;
    if (calls >= 3 && !/\b(memo|cache|dp|lru_cache)\b/i.test(code)) return name; // 1 declaration + >= 2 calls
  }
  return null;
}

const hasNullCheck = (code) => /(==|!=)\s*(null|nullptr|NULL)\b|\b(null|nullptr|NULL)\s*(==|!=)|\bis\s+(not\s+)?None\b|\bif\s+not\s+\w+|!\s*\w+\s*\)|\bif\s*\(\s*!\s*\w+/.test(code);
const isNumber = (s) => typeof s === 'string' && /^-?\d+$/.test(s.trim());
const listLength = (s) => {
  const t = String(s || '').trim();
  if (!/^\[.*\]$/.test(t) || /^\[\s*\[/.test(t)) return null;
  const inner = t.slice(1, -1).trim();
  return inner ? inner.split(',').length : 0;
};

function result(category, confidence, ruleId, title, explanation, evidence, suggestion, problem, failingTest) {
  return {
    category,
    confidence,
    ruleId,
    title,
    explanation,
    evidence: evidence.filter(Boolean),
    suggestion,
    practiceTopic: (category && CATEGORY_INFO[category] && CATEGORY_INFO[category].practiceTopic) || (problem && problem.topic) || null,
    failingTestId: failingTest ? failingTest.id : null
  };
}

// ------------------------------------------------------------------ rules

/** Language-neutral error kind (Java types are mapped here when a harness did not set one). */
function errorKind(err) {
  if (err.kind) return err.kind;
  const t = err.type || '';
  if (/IndexOutOfBoundsException$/.test(t)) return 'index';
  if (t === 'NullPointerException') return 'null';
  if (t === 'StackOverflowError') return 'stack-overflow';
  if (t === 'ArithmeticException') return 'arithmetic';
  if (t === 'EmptyStackException' || t === 'NoSuchElementException') return 'empty-collection';
  return 'other';
}

const POINTER_TOPICS = ['Linked List', 'Trees'];

function analyzeException(code, problem, test) {
  const err = test.error;
  const kind = errorKind(err);
  const errText = `\`${err.type}${err.message && err.message !== 'null' ? ': ' + err.message : ''}\``;
  const where = err.line ? `Thrown at line ${err.line}: \`${lineAt(code, err.line) || '?'}\`` : null;
  const onInput = `Failed on ${describeTest(test)}${test.hidden ? '' : ` with input ${test.input}`}.`;
  const edgeNote = test.edge ? `This test is an edge case (${test.edge}).` : null;

  // AI-01
  if (kind === 'index') {
    const m = (err.message || '').match(/(?:Index|index:?|out of range:?)\s*(-?\d+).*?(?:length|holds)\s*(\d+)/i)
      || (err.message || '').match(/(-?\d+)/);
    // (Python's IndexError has no numbers; then only the line and input are reported)
    const index = m ? Number(m[1]) : null;
    const length = m && m[2] !== undefined ? Number(m[2]) : null;
    const bounds = findLengthInclusiveBounds(code);
    const evidence = [
      errText,
      onInput,
      where,
      edgeNote
    ];
    let suggestion = 'Check every array/string access at the reported line and make sure the index stays within [0, length - 1].';
    if (index !== null && length !== null && index === length) {
      evidence.push(`Index ${index} equals the length, but the last valid index is ${length - 1} (off by one).`);
      suggestion = 'Stop the loop at the last valid index (`i < n`, not `i <= n`), and check look-ahead accesses like `arr[i + 1]` on the last iteration.';
    } else if (index !== null && index < 0) {
      evidence.push(`A negative index (${index}) was used.`);
      suggestion = 'Guard look-behind accesses such as `arr[i - 1]` (start the loop at 1, or check `i > 0`).';
    } else if (length === 0) {
      evidence.push('The array/string was empty, so no index is valid.');
      suggestion = 'Handle an empty input before reading any element (return early when the length is 0).';
    }
    bounds.forEach((b) => evidence.push(`Line ${b.line} uses an inclusive length bound: \`${b.text}\``));
    return result('Array Indexing', 'high', 'AI-01', 'Array index out of range',
      'Your code accessed an index outside the valid range of an array or string.', evidence, suggestion, problem, test);
  }

  // NH-01
  if (kind === 'null') {
    const msg = (err.message || '').replace(/"<local\d+>"/g, 'a local variable');
    const evidence = [`\`${err.type}${msg && msg !== 'null' ? ': ' + msg : ''}\``, onInput, where, edgeNote];
    if (!hasNullCheck(code)) evidence.push('No null / None check was found anywhere in your code.');
    return result('Null Handling', 'high', 'NH-01', 'Null reference dereferenced',
      'Your code read a field or called a method on a reference that was null.', evidence,
      'Add a guard before dereferencing (return early when the node is null / None) and make loops stop when the pointer becomes null (check both `fast` and `fast.next`).',
      problem, test);
  }

  // RE-01
  // NH-02 / AI-03: C++ segmentation fault (no exception, only a signal)
  if (kind === 'segfault') {
    const pointerProblem = problem && POINTER_TOPICS.includes(problem.topic);
    return result(pointerProblem ? 'Null Handling' : 'Array Indexing', 'possible', pointerProblem ? 'NH-02' : 'AI-03',
      `Possible mistake: ${pointerProblem ? 'null pointer dereference' : 'invalid memory index'}`,
      'The program crashed with a segmentation fault (an invalid memory access). C++ does not say which access was invalid, so this is reported as a possible mistake.',
      [errText, onInput, edgeNote,
        pointerProblem ? 'On linked-list / tree problems this is most often `node->next` or `node->left` when `node` is `nullptr`.' : 'On array problems this is most often an index outside the array or an uninitialised pointer.'],
      pointerProblem
        ? 'Check for `nullptr` before every `->` access, especially for empty input and at the end of the list/tree.'
        : 'Check every index against the container size, and test with an empty and a single-element input.',
      problem, test);
  }

  if (kind === 'stack-overflow') {
    return result('Runtime Errors', 'high', 'RE-01', 'Stack overflow (runaway recursion)',
      'A recursive method kept calling itself until the call stack ran out.',
      [errText, onInput, where, edgeNote],
      'Make sure every recursive call moves toward a base case, and that the base case (e.g. `if (root == null) return 0;`) is checked before recursing.',
      problem, test);
  }

  // RE-02
  if (kind === 'arithmetic') {
    return result('Runtime Errors', 'high', 'RE-02', 'Invalid arithmetic',
      'An arithmetic operation failed (most often division or modulo by zero).',
      [errText, onInput, where, edgeNote],
      'Check divisors and modulo operands before using them, especially for empty or zero-valued input.',
      problem, test);
  }

  // RE-03
  if (kind === 'empty-collection') {
    return result('Runtime Errors', 'high', 'RE-03', 'Removed from an empty collection',
      'pop(), poll(), remove() or next() was called on an empty stack, queue or iterator.',
      [errText, onInput, where, edgeNote],
      'Check that the stack/queue is not empty before popping or peeking (e.g. `isEmpty()`, `if stack:`, `!st.empty()`).',
      problem, test);
  }

  // RE-04
  return result('Runtime Errors', 'high', 'RE-04', `Runtime exception: ${err.type}`,
    'Your program threw an exception that was not handled.',
    [errText, onInput, where, edgeNote],
    'Read the error name and the reported line, then check the values involved for the failing input.',
    problem, test);
}

function analyzeTimeLimit(code, problem, test) {
  const stuck = findStuckWhileLoops(code);
  const where = test ? `Time limit exceeded on ${describeTest(test)}${test.hidden ? '' : ` (input ${test.input})`}.` : 'Time limit exceeded.';
  if (stuck.length) {
    const s = stuck[0];
    return result('Loop Logic', 'high', 'LL-01', 'Loop never terminates',
      'A while-loop can never reach its exit condition, so the program ran until the time limit.',
      [where, `Line ${s.line}: \`while ${s.condition}\` - none of ${s.vars.map((v) => '`' + v + '`').join(', ')} is updated inside the loop body.`],
      'Update the loop variable on every path through the loop body (e.g. `left += 1`, `right -= 1`, `node = node.next`).',
      problem, test);
  }
  const recursive = findBranchingRecursion(code);
  return result('Loop Logic', 'possible', 'LL-02', 'Possible mistake: loop does not finish in time',
    'The program exceeded the time limit. DebugTrack cannot prove whether a loop never terminates or the algorithm is simply too slow for this input size.',
    [where,
      recursive ? `\`${recursive}\` calls itself more than once without memoisation, which can take exponential time.` : null],
    recursive
      ? 'Store results you have already computed (a dp array or memo map), or rewrite the recursion as a loop.'
      : 'Check that every loop moves toward its exit condition, and look for nested loops that could be replaced by a HashMap or two pointers.',
    problem, test);
}

function analyzeWrongAnswer(code, problem, tests) {
  const failing = tests.filter((t) => !t.passed);
  const passing = tests.filter((t) => t.passed);
  const first = failing[0];
  const show = (t) => (t.hidden && t !== first)
    ? `${describeTest(t)} failed`
    : `${describeTest(t)}: input ${t.input} - expected ${t.expected}, got ${t.actual}`;

  // BC-01: only edge cases fail while regular cases pass
  const regularPassing = passing.filter((t) => !t.edge);
  if (failing.length && failing.every((t) => t.edge) && regularPassing.length > 0) {
    return result('Boundary Conditions', 'high', 'BC-01', 'Edge cases not handled',
      'Your solution passes the regular test cases but fails only on edge cases.',
      [`${regularPassing.length} regular test${regularPassing.length > 1 ? 's' : ''} passed.`,
        ...failing.slice(0, 3).map(show)],
      `Handle the extremes explicitly: ${[...new Set(failing.map((t) => t.edge))].join(', ')}. Walk through these inputs by hand.`,
      problem, first);
  }

  // LL-03: off by exactly one
  const numericFails = failing.filter((t) => isNumber(t.actual) && isNumber(t.expected));
  const offByOneNumeric = numericFails.length > 0 && numericFails.length === failing.length &&
    numericFails.every((t) => Math.abs(Number(t.actual) - Number(t.expected)) === 1);
  const listFails = failing.filter((t) => listLength(t.actual) !== null && listLength(t.expected) !== null);
  const offByOneList = listFails.length > 0 && listFails.length === failing.length &&
    listFails.every((t) => Math.abs(listLength(t.actual) - listLength(t.expected)) === 1);
  if (offByOneNumeric || offByOneList) {
    const bounds = findLengthInclusiveBounds(code);
    return result('Loop Logic', 'possible', 'LL-03', 'Possible mistake: off-by-one iteration',
      offByOneNumeric
        ? 'Every wrong answer differs from the expected value by exactly 1, which often means a loop runs one time too many or too few.'
        : 'Every wrong list has exactly one element too many or too few, which often means a loop runs one time too many or too few.',
      [...failing.slice(0, 3).map(show), ...bounds.map((b) => `Line ${b.line}: \`${b.text}\``)],
      'Check loop start values (0 vs 1) and exit conditions (< vs <=), and trace the first and last iteration by hand.',
      problem, first);
  }

  // UC-01: insufficient evidence
  const edgeFails = failing.filter((t) => t.edge);
  return result('Unclassified', 'possible', 'UC-01', 'Unclassified wrong answer',
    'Your output did not match the expected output, and the evidence is not strong enough to name a specific mistake pattern.',
    [...failing.slice(0, 3).map(show),
      edgeFails.length && edgeFails.length < failing.length ? `Some failing tests are edge cases (${[...new Set(edgeFails.map((t) => t.edge))].join(', ')}), but regular cases fail too.` : null,
      `${passing.length} of ${tests.length} tests passed.`],
    'Trace the first failing input by hand, print intermediate values, and compare each step with the problem examples.',
    problem, first);
}

/**
 * Analyses a non-accepted execution.
 * @returns analysis object, or null for Accepted submissions.
 */
function analyzeSubmission({ code, problem, execution, language = 'java' }) {
  if (!execution || execution.verdict === 'Accepted') return null;
  const tests = execution.tests || [];

  const starter = problem && ((problem.starterCodes && problem.starterCodes[language]) || (language === 'java' && problem.starterCode));
  if (starter && code.replace(/\s+/g, '') === starter.replace(/\s+/g, '')) {
    return {
      category: null, confidence: 'high', ruleId: 'NS-01', title: 'Starter code submitted unchanged',
      explanation: 'The submitted code is identical to the starter template, so there is no solution logic to analyse. This attempt is not counted as a mistake pattern.',
      evidence: [], suggestion: 'Implement the method body, then use Run Code to check the sample tests.',
      practiceTopic: null, failingTestId: null
    };
  }

  if (execution.verdict === 'Compilation Error') {
    const errors = (execution.compileOutput || '').split('\n').filter((l) => /error:/.test(l)).slice(0, 3);
    const missingSolution = /class Solution|cannot find symbol[\s\S]*Solution|'Solution' was not declared|Solution.*not defined/.test(execution.compileOutput || '');
    return {
      category: null, confidence: 'high', ruleId: 'CE-01', title: 'Compilation error',
      explanation: 'The code did not compile, so no test was run. Compilation errors are syntax or type problems and are not counted as logic mistake patterns.',
      evidence: errors.length ? errors : [(execution.compileOutput || '').slice(0, 300)],
      suggestion: missingSolution
        ? 'Keep the `Solution` class and the method signature exactly as given in the starter code.'
        : 'Fix the first compiler error first; later errors are often caused by it. Line numbers refer to your editor.',
      practiceTopic: null, failingTestId: null
    };
  }

  const errored = tests.find((t) => t.error);
  if (errored) return analyzeException(code, problem, errored);

  if (execution.verdict === 'Time Limit Exceeded') {
    return analyzeTimeLimit(code, problem, tests.find((t) => t.status === 'Time Limit Exceeded'));
  }

  if (execution.verdict === 'Runtime Error') {
    const t = tests.find((x) => !x.passed);
    return result('Runtime Errors', 'possible', 'RE-04', 'Possible mistake: program terminated abnormally',
      'The program stopped without reporting a specific exception (for example, it ran out of memory).',
      [t ? `Stopped during ${describeTest(t)}.` : null, execution.stderr ? `stderr: ${execution.stderr.slice(0, 200)}` : null],
      'Look for very large allocations or unbounded recursion/loops.', problem, t);
  }

  return analyzeWrongAnswer(code, problem, tests);
}

module.exports = {
  analyzeSubmission,
  CATEGORIES,
  CATEGORY_INFO,
  RULES,
  // exported for unit tests
  findLengthInclusiveBounds,
  findStuckWhileLoops
};
