/**
 * Generates the demo account's practice history by submitting REAL Java code (typical student
 * mistakes followed by fixes) through the normal pipeline: Judge0 -> mistake engine -> SQLite.
 * Nothing is hard-coded: verdicts, runtimes and mistake categories are whatever the pipeline
 * produces. Timestamps are spread over the past weeks so the trend charts have a history.
 *
 * Usage: node scripts/seedDemo.js   (run `node seed.js --reset` first for a clean database)
 */
const { ready, get, run } = require('../database');
const { evaluate } = require('../services/submissionService');
const { DEMO_USER } = require('../seed');

const DAY = 24 * 3600 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [daysAgo, problemId, code]   (ordered oldest -> newest)
const ATTEMPTS = [
  [34, 'two-sum', `class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j <= nums.length; j++) {
                if (nums[i] + nums[j] == target) return new int[] { i, j };
            }
        }
        return new int[0];
    }
}`],
  [34, 'two-sum', `class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) return new int[] { i, j };
            }
        }
        return new int[0];
    }
}`],
  [32, 'move-zeroes', `class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] != 0) nums[write++] = nums[i];
        }
        while (write <= nums.length) nums[write++] = 0;
    }
}`],
  [31, 'running-sum', `class Solution {
    public int[] runningSum(int[] nums) {
        int[] result = new int[nums.length];
        for (int i = 0; i < nums.length; i++) {
            result[i] = result[i - 1] + nums[i];
        }
        return result;
    }
}`],
  [30, 'search-insert', `class Solution {
    public int searchInsert(int[] nums, int target) {
        int left = 0, right = nums.length - 1
        while (left <= right) {
            int mid = (left + right) / 2;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return left;
    }
}`],
  [30, 'search-insert', `class Solution {
    public int searchInsert(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = (left + right) / 2;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return left;
    }
}`],
  [28, 'reverse-linked-list', `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr.next != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        curr.next = prev;
        return curr;
    }
}`],
  [27, 'move-zeroes', `class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for (int i = 0; i < nums.length; i++) {
            if (nums[i] != 0) nums[write++] = nums[i];
        }
        while (write < nums.length) nums[write++] = 0;
    }
}`],
  [25, 'binary-search', `class Solution {
    public int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left < right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return -1;
    }
}`],
  [24, 'valid-parentheses', `class Solution {
    public boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') stack.push(c);
            else {
                char open = stack.pop();
                if (c == ')' && open != '(') return false;
                if (c == ']' && open != '[') return false;
                if (c == '}' && open != '{') return false;
            }
        }
        return stack.isEmpty();
    }
}`],
  [23, 'maximum-subarray', `class Solution {
    public int maxSubArray(int[] nums) {
        int best = 0, cur = 0;
        for (int x : nums) {
            cur = Math.max(x, cur + x);
            best = Math.max(best, cur);
        }
        return best;
    }
}`],
  [22, 'max-depth', `class Solution {
    public int maxDepth(TreeNode root) {
        if (root.left == null && root.right == null) return 1;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`],
  [21, 'running-sum', `class Solution {
    public int[] runningSum(int[] nums) {
        int[] result = new int[nums.length];
        result[0] = nums[0];
        for (int i = 1; i < nums.length; i++) result[i] = result[i - 1] + nums[i];
        return result;
    }
}`],
  [20, 'climbing-stairs', `class Solution {
    public int climbStairs(int n) {
        if (n <= 2) return n;
        return climbStairs(n - 1) + climbStairs(n - 2);
    }
}`],
  [19, 'house-robber', `class Solution {
    public int rob(int[] nums) {
        int[] dp = new int[nums.length];
        dp[0] = nums[0];
        dp[1] = Math.max(nums[0], nums[1]);
        for (int i = 2; i < nums.length; i++) dp[i] = Math.max(dp[i - 1], dp[i - 2] + nums[i]);
        return dp[nums.length - 1];
    }
}`],
  [18, 'reverse-linked-list', `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        return prev;
    }
}`],
  [17, 'binary-search', `class Solution {
    public int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return -1;
    }
}`],
  [15, 'longest-substring', `class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> last = new HashMap<>();
        int best = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (last.containsKey(c)) left = last.get(c) + 1;
            last.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}`],
  [14, 'count-components', `class Solution {
    public int countComponents(int n, int[][] edges) {
        int[] parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
        int comps = n;
        for (int[] e : edges) {
            int a = find(parent, e[0]), b = find(parent, e[1]);
            if (a != b) { parent[a] = b; comps--; }
        }
        return comps;
    }
    private int find(int[] p, int x) {
        while (p[x] != x) {
            p[x] = p[p[x]];
        }
        return x;
    }
}`],
  [12, 'valid-parentheses', `class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '[') stack.push(']');
            else if (c == '{') stack.push('}');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}`],
  [11, 'climbing-stairs', `class Solution {
    public int climbStairs(int n) {
        int a = 1, b = 1;
        for (int i = 2; i <= n; i++) { int c = a + b; a = b; b = c; }
        return b;
    }
}`],
  [10, 'number-of-islands', `class Solution {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++)
            for (int c = 0; c < grid[0].length; c++)
                if (grid[r][c] == '1') { count++; sink(grid, r, c); }
        return count;
    }
    private void sink(char[][] g, int r, int c) {
        if (g[r][c] != '1') return;
        g[r][c] = '0';
        sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
    }
}`],
  [9, 'maximum-subarray', `class Solution {
    public int maxSubArray(int[] nums) {
        int best = nums[0], cur = nums[0];
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]);
            best = Math.max(best, cur);
        }
        return best;
    }
}`],
  [8, 'valid-anagram', `class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) { count[s.charAt(i) - 'a']++; count[t.charAt(i) - 'a']--; }
        for (int c : count) if (c != 0) return false;
        return true;
    }
}`],
  [7, 'max-depth', `class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`],
  [6, 'middle-of-list', `class Solution {
    public ListNode middleNode(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        return slow;
    }
}`],
  [5, 'number-of-islands', `class Solution {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++)
            for (int c = 0; c < grid[0].length; c++)
                if (grid[r][c] == '1') { count++; sink(grid, r, c); }
        return count;
    }
    private void sink(char[][] g, int r, int c) {
        if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
        g[r][c] = '0';
        sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
    }
}`],
  [4, 'sort-colors', `class Solution {
    public void sortColors(int[] nums) {
        int low = 0, mid = 0, high = nums.length - 1;
        while (mid <= high) {
            if (nums[mid] == 0) { int t = nums[low]; nums[low++] = nums[mid]; nums[mid++] = t; }
            else if (nums[mid] == 1) mid++;
            else { int t = nums[high]; nums[high--] = nums[mid]; nums[mid] = t; }
        }
    }
}`],
  [3, 'evaluate-postfix', `class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> st = new ArrayDeque<>();
        for (String tk : tokens) {
            if (tk.equals("+")) st.push(st.pop() + st.pop());
            else if (tk.equals("-")) st.push(st.pop() - st.pop());
            else if (tk.equals("*")) st.push(st.pop() * st.pop());
            else if (tk.equals("/")) st.push(st.pop() / st.pop());
            else st.push(Integer.parseInt(tk));
        }
        return st.pop();
    }
}`],
  [2, 'house-robber', `class Solution {
    public int rob(int[] nums) {
        int prev = 0, cur = 0;
        for (int x : nums) { int next = Math.max(cur, prev + x); prev = cur; cur = next; }
        return cur;
    }
}`],
  [1, 'first-unique-char', `class Solution {
    public int firstUniqChar(String s) {
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        for (int i = 0; i < s.length(); i++) if (count[s.charAt(i) - 'a'] == 1) return i;
        return -1;
    }
}`]
];

(async () => {
  await ready;
  const user = await get('SELECT id FROM users WHERE email = ?', [DEMO_USER.email]);
  if (!user) throw new Error('Demo user not found. Run `node seed.js --reset` first.');
  await run('DELETE FROM submissions WHERE userId = ?', [user.id]);

  for (let i = 0; i < ATTEMPTS.length; i++) {
    const [daysAgo, problemId, code] = ATTEMPTS[i];
    // spread attempts across the afternoon/evening of that day
    const ts = new Date(Date.now() - daysAgo * DAY - (6 - (i % 5)) * 3600 * 1000).toISOString();
    let attempt = 0;
    for (;;) {
      try {
        const r = await evaluate(user.id, { problemId, code, language: 'java' }, { mode: 'submit', timestamp: ts });
        console.log(`${String(i + 1).padStart(2)}. ${problemId.padEnd(22)} ${r.status.padEnd(20)} ${r.analysis ? `${r.analysis.category || '-'} (${r.analysis.ruleId}, ${r.analysis.confidence})` : ''}`);
        break;
      } catch (err) {
        if (++attempt >= 3) throw err;
        console.log(`   retrying ${problemId} after error: ${err.message}`);
        await sleep(3000);
      }
    }
    await sleep(700);
  }
  console.log(`\nGenerated ${ATTEMPTS.length} real demo submissions for ${DEMO_USER.email}.`);
  process.exit(0);
})().catch((err) => { console.error('Demo seeding failed:', err.message); process.exit(1); });
