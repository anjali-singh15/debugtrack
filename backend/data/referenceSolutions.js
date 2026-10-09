/**
 * Python and C++ reference solutions used ONLY by scripts/verifyProblems.js to check the
 * Python/C++ harnesses. Together they cover every parameter type, return type and the
 * in-place pattern used by the problem bank. (Java references live in problems.js.)
 */
module.exports = {
  'two-sum': {
    python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []`,
    cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`
  },
  'move-zeroes': {
    python: `class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        w = 0
        for x in nums:
            if x != 0:
                nums[w] = x
                w += 1
        for i in range(w, len(nums)):
            nums[i] = 0`,
    cpp: `class Solution {
public:
    void moveZeroes(vector<int>& nums) {
        int w = 0;
        for (int x : nums) if (x != 0) nums[w++] = x;
        while (w < (int)nums.size()) nums[w++] = 0;
    }
};`
  },
  'merge-sorted-array': {
    python: `class Solution:
    def merge(self, nums1: List[int], m: int, nums2: List[int], n: int) -> None:
        i, j, k = m - 1, n - 1, m + n - 1
        while j >= 0:
            if i >= 0 and nums1[i] > nums2[j]:
                nums1[k] = nums1[i]; i -= 1
            else:
                nums1[k] = nums2[j]; j -= 1
            k -= 1`,
    cpp: `class Solution {
public:
    void merge(vector<int>& nums1, int m, vector<int>& nums2, int n) {
        int i = m - 1, j = n - 1, k = m + n - 1;
        while (j >= 0) {
            if (i >= 0 && nums1[i] > nums2[j]) nums1[k--] = nums1[i--];
            else nums1[k--] = nums2[j--];
        }
    }
};`
  },
  'reverse-words': {
    python: `class Solution:
    def reverseWords(self, s: str) -> str:
        return " ".join(reversed(s.split()))`,
    cpp: `class Solution {
public:
    string reverseWords(string s) {
        stringstream ss(s);
        vector<string> words;
        string w;
        while (ss >> w) words.push_back(w);
        string out;
        for (int i = (int)words.size() - 1; i >= 0; i--) {
            out += words[i];
            if (i > 0) out += " ";
        }
        return out;
    }
};`
  },
  'valid-palindrome': {
    python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        t = [c.lower() for c in s if c.isalnum()]
        return t == t[::-1]`,
    cpp: `class Solution {
public:
    bool isPalindrome(string s) {
        int i = 0, j = (int)s.size() - 1;
        while (i < j) {
            while (i < j && !isalnum((unsigned char)s[i])) i++;
            while (i < j && !isalnum((unsigned char)s[j])) j--;
            if (tolower(s[i]) != tolower(s[j])) return false;
            i++; j--;
        }
        return true;
    }
};`
  },
  'first-last-position': {
    python: `import bisect
class Solution:
    def searchRange(self, nums: List[int], target: int) -> List[int]:
        lo = bisect.bisect_left(nums, target)
        if lo == len(nums) or nums[lo] != target:
            return [-1, -1]
        return [lo, bisect.bisect_right(nums, target) - 1]`,
    cpp: `class Solution {
public:
    vector<int> searchRange(vector<int>& nums, int target) {
        auto lo = lower_bound(nums.begin(), nums.end(), target);
        if (lo == nums.end() || *lo != target) return {-1, -1};
        auto hi = upper_bound(nums.begin(), nums.end(), target);
        return {(int)(lo - nums.begin()), (int)(hi - nums.begin()) - 1};
    }
};`
  },
  'merge-intervals': {
    python: `class Solution:
    def merge(self, intervals: List[List[int]]) -> List[List[int]]:
        out = []
        for s, e in sorted(intervals):
            if out and out[-1][1] >= s:
                out[-1][1] = max(out[-1][1], e)
            else:
                out.append([s, e])
        return out`,
    cpp: `class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());
        vector<vector<int>> out;
        for (auto& iv : intervals) {
            if (!out.empty() && out.back()[1] >= iv[0]) out.back()[1] = max(out.back()[1], iv[1]);
            else out.push_back(iv);
        }
        return out;
    }
};`
  },
  'reverse-linked-list': {
    python: `class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        while head:
            nxt = head.next
            head.next = prev
            prev = head
            head = nxt
        return prev`,
    cpp: `class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        while (head) { ListNode* nxt = head->next; head->next = prev; prev = head; head = nxt; }
        return prev;
    }
};`
  },
  'merge-two-lists': {
    python: `class Solution:
    def mergeTwoLists(self, a: Optional[ListNode], b: Optional[ListNode]) -> Optional[ListNode]:
        dummy = tail = ListNode(0)
        while a and b:
            if a.val <= b.val:
                tail.next, a = a, a.next
            else:
                tail.next, b = b, b.next
            tail = tail.next
        tail.next = a or b
        return dummy.next`,
    cpp: `class Solution {
public:
    ListNode* mergeTwoLists(ListNode* a, ListNode* b) {
        ListNode dummy; ListNode* tail = &dummy;
        while (a && b) {
            if (a->val <= b->val) { tail->next = a; a = a->next; } else { tail->next = b; b = b->next; }
            tail = tail->next;
        }
        tail->next = a ? a : b;
        return dummy.next;
    }
};`
  },
  'max-depth': {
    python: `class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))`,
    cpp: `class Solution {
public:
    int maxDepth(TreeNode* root) {
        if (!root) return 0;
        return 1 + max(maxDepth(root->left), maxDepth(root->right));
    }
};`
  },
  'level-order': {
    python: `class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        out, level = [], [root] if root else []
        while level:
            out.append([n.val for n in level])
            level = [c for n in level for c in (n.left, n.right) if c]
        return out`,
    cpp: `class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        vector<vector<int>> out;
        if (!root) return out;
        queue<TreeNode*> q; q.push(root);
        while (!q.empty()) {
            int size = q.size();
            vector<int> level;
            for (int i = 0; i < size; i++) {
                TreeNode* n = q.front(); q.pop();
                level.push_back(n->val);
                if (n->left) q.push(n->left);
                if (n->right) q.push(n->right);
            }
            out.push_back(level);
        }
        return out;
    }
};`
  },
  'path-sum': {
    python: `class Solution:
    def hasPathSum(self, root: Optional[TreeNode], target: int) -> bool:
        if not root:
            return False
        if not root.left and not root.right:
            return root.val == target
        return self.hasPathSum(root.left, target - root.val) or self.hasPathSum(root.right, target - root.val)`,
    cpp: `class Solution {
public:
    bool hasPathSum(TreeNode* root, int target) {
        if (!root) return false;
        if (!root->left && !root->right) return root->val == target;
        return hasPathSum(root->left, target - root->val) || hasPathSum(root->right, target - root->val);
    }
};`
  },
  'number-of-islands': {
    python: `class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        rows, cols = len(grid), len(grid[0])
        def sink(r, c):
            if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] != "1":
                return
            grid[r][c] = "0"
            sink(r + 1, c); sink(r - 1, c); sink(r, c + 1); sink(r, c - 1)
        count = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1":
                    count += 1
                    sink(r, c)
        return count`,
    cpp: `class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        int count = 0;
        for (int r = 0; r < (int)grid.size(); r++)
            for (int c = 0; c < (int)grid[0].size(); c++)
                if (grid[r][c] == '1') { count++; sink(grid, r, c); }
        return count;
    }
    void sink(vector<vector<char>>& g, int r, int c) {
        if (r < 0 || c < 0 || r >= (int)g.size() || c >= (int)g[0].size() || g[r][c] != '1') return;
        g[r][c] = '0';
        sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
    }
};`
  },
  'count-components': {
    python: `class Solution:
    def countComponents(self, n: int, edges: List[List[int]]) -> int:
        parent = list(range(n))
        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        comps = n
        for a, b in edges:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb
                comps -= 1
        return comps`,
    cpp: `class Solution {
public:
    int countComponents(int n, vector<vector<int>>& edges) {
        vector<int> p(n);
        iota(p.begin(), p.end(), 0);
        function<int(int)> find = [&](int x) { while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; } return x; };
        int comps = n;
        for (auto& e : edges) { int a = find(e[0]), b = find(e[1]); if (a != b) { p[a] = b; comps--; } }
        return comps;
    }
};`
  },
  'shortest-path': {
    python: `class Solution:
    def fewestHops(self, n: int, edges: List[List[int]], start: int, end: int) -> int:
        adj = [[] for _ in range(n)]
        for a, b in edges:
            adj[a].append(b); adj[b].append(a)
        dist = [-1] * n
        dist[start] = 0
        q = deque([start])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if dist[v] == -1:
                    dist[v] = dist[u] + 1
                    q.append(v)
        return dist[end]`,
    cpp: `class Solution {
public:
    int fewestHops(int n, vector<vector<int>>& edges, int start, int end) {
        vector<vector<int>> adj(n);
        for (auto& e : edges) { adj[e[0]].push_back(e[1]); adj[e[1]].push_back(e[0]); }
        vector<int> dist(n, -1);
        dist[start] = 0;
        queue<int> q; q.push(start);
        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (int v : adj[u]) if (dist[v] == -1) { dist[v] = dist[u] + 1; q.push(v); }
        }
        return dist[end];
    }
};`
  },
  'evaluate-postfix': {
    python: `class Solution:
    def evalRPN(self, tokens: List[str]) -> int:
        st = []
        for tk in tokens:
            if tk in "+-*/" and len(tk) == 1:
                b, a = st.pop(), st.pop()
                if tk == "+": st.append(a + b)
                elif tk == "-": st.append(a - b)
                elif tk == "*": st.append(a * b)
                else: st.append(int(a / b))
            else:
                st.append(int(tk))
        return st[-1]`,
    cpp: `class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        stack<int> st;
        for (auto& tk : tokens) {
            if (tk == "+" || tk == "-" || tk == "*" || tk == "/") {
                int b = st.top(); st.pop();
                int a = st.top(); st.pop();
                if (tk == "+") st.push(a + b);
                else if (tk == "-") st.push(a - b);
                else if (tk == "*") st.push(a * b);
                else st.push(a / b);
            } else st.push(stoi(tk));
        }
        return st.top();
    }
};`
  },
  'climbing-stairs': {
    python: `class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 1, 1
        for _ in range(n - 1):
            a, b = b, a + b
        return b`,
    cpp: `class Solution {
public:
    int climbStairs(int n) {
        int a = 1, b = 1;
        for (int i = 2; i <= n; i++) { int c = a + b; a = b; b = c; }
        return b;
    }
};`
  }
};
