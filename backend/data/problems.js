/**
 * DebugTrack - Curated Problem Bank (server-side source of truth)
 *
 * Each problem carries:
 *   - public content (statement, examples, constraints, hints, Java starter code)
 *   - `focus`: mistake categories the problem trains (used by the recommendation engine)
 *   - `tests`: sample + hidden test cases. Hidden tests are never sent to the browser.
 *       input     human-readable input shown to the student
 *       expected  canonical expected output (compared after whitespace normalisation)
 *       call      Java statements executed in the Judge0 harness; must print via DT.out / DT.outList
 *       edge      optional label marking an edge-case test (used as Boundary Conditions evidence)
 *       hidden    true for tests only executed on Submit
 *       compare   'unordered' to accept any element order in a flat array answer
 *   - `referenceSolution`: a known-correct solution, only used by the verification script.
 *
 * Statements are written for DebugTrack; well-known problem names are used only as
 * conventional titles for classic algorithm exercises.
 */

function t(input, expected, call, opts) {
  return Object.assign({ input, expected, call }, opts || {});
}
const H = { hidden: true };
const edge = (label, hidden) => ({ edge: label, hidden: hidden !== false });

const PROBLEMS = [
  // ===================================================================== ARRAYS
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Loop Logic'],
    mistakeProneArea: 'Index pairing & hash lookups',
    description:
      'You are given an integer array `nums` and an integer `target`. Find two different positions `i` and `j` such that `nums[i] + nums[j] == target`, and return them as `[i, j]` with `i < j`.\n\n' +
      'Every input has exactly one valid pair, and an element cannot be paired with itself.',
    examples: [
      { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9.' },
      { input: 'nums = [3, 2, 4], target = 6', output: '[1, 2]', explanation: 'nums[1] + nums[2] = 2 + 4 = 6.' }
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i], target <= 10^9', 'Exactly one valid answer exists.'],
    hints: [
      'Checking every pair works but is O(n^2). Can a HashMap remember values you have already seen?',
      'Look up the complement (target - nums[i]) before inserting nums[i], so an element is never paired with itself.'
    ],
    starterCode: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Return the two indices [i, j] with i < j
        return new int[0];
    }
}`,
    referenceSolution: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[] { j, i };
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`,
    tests: [
      t('nums = [2, 7, 11, 15], target = 9', '[0, 1]', 'DT.out(sol.twoSum(new int[]{2, 7, 11, 15}, 9));', { compare: 'unordered' }),
      t('nums = [3, 2, 4], target = 6', '[1, 2]', 'DT.out(sol.twoSum(new int[]{3, 2, 4}, 6));', { compare: 'unordered' }),
      t('nums = [3, 3], target = 6', '[0, 1]', 'DT.out(sol.twoSum(new int[]{3, 3}, 6));', { compare: 'unordered', edge: 'duplicate values', hidden: false }),
      t('nums = [1, 5, 7, 12, 19], target = 20', '[0, 4]', 'DT.out(sol.twoSum(new int[]{1, 5, 7, 12, 19}, 20));', { compare: 'unordered', edge: 'pair spans first and last index', hidden: true }),
      t('nums = [-3, 4, 3, 90], target = 0', '[0, 2]', 'DT.out(sol.twoSum(new int[]{-3, 4, 3, 90}, 0));', { compare: 'unordered', hidden: true }),
      t('nums = [-1, -2, -3, -4, -5], target = -8', '[2, 4]', 'DT.out(sol.twoSum(new int[]{-1, -2, -3, -4, -5}, -8));', { compare: 'unordered', edge: 'negative numbers', hidden: true })
    ]
  },
  {
    id: 'move-zeroes',
    title: 'Move Zeroes',
    difficulty: 'Easy',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Loop Logic'],
    mistakeProneArea: 'Write-pointer synchronisation',
    description:
      'Rearrange the integer array `nums` so that every `0` is moved to the end, while the non-zero values keep their original relative order.\n\n' +
      'Modify `nums` in place; do not allocate a second array.',
    examples: [
      { input: 'nums = [0, 1, 0, 3, 12]', output: '[1, 3, 12, 0, 0]', explanation: 'Non-zero values 1, 3, 12 keep their order; the two zeros move to the end.' },
      { input: 'nums = [0]', output: '[0]' }
    ],
    constraints: ['1 <= nums.length <= 10^4', '-2^31 <= nums[i] <= 2^31 - 1'],
    hints: [
      'Keep a write index that marks where the next non-zero value should go.',
      'After copying the non-zero values forward, fill the remaining positions with zeros. Make sure the fill loop stops at nums.length - 1.'
    ],
    starterCode: `class Solution {
    public void moveZeroes(int[] nums) {
        // Modify nums in place
    }
}`,
    referenceSolution: `class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for (int num : nums) {
            if (num != 0) nums[write++] = num;
        }
        while (write < nums.length) nums[write++] = 0;
    }
}`,
    tests: [
      t('nums = [0, 1, 0, 3, 12]', '[1, 3, 12, 0, 0]', '{ int[] a = {0, 1, 0, 3, 12}; sol.moveZeroes(a); DT.out(a); }'),
      t('nums = [0]', '[0]', '{ int[] a = {0}; sol.moveZeroes(a); DT.out(a); }', edge('single element', false)),
      t('nums = [4, 2, 4, 0, 0, 3, 0, 5, 1, 0]', '[4, 2, 4, 3, 5, 1, 0, 0, 0, 0]', '{ int[] a = {4, 2, 4, 0, 0, 3, 0, 5, 1, 0}; sol.moveZeroes(a); DT.out(a); }', H),
      t('nums = [1, 2, 3]', '[1, 2, 3]', '{ int[] a = {1, 2, 3}; sol.moveZeroes(a); DT.out(a); }', edge('no zeros')),
      t('nums = [0, 0, 1]', '[1, 0, 0]', '{ int[] a = {0, 0, 1}; sol.moveZeroes(a); DT.out(a); }', H),
      t('nums = [0, 0, 0]', '[0, 0, 0]', '{ int[] a = {0, 0, 0}; sol.moveZeroes(a); DT.out(a); }', edge('all zeros'))
    ]
  },
  {
    id: 'merge-sorted-array',
    title: 'Merge Sorted Array',
    difficulty: 'Easy',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'Three-pointer traversal & bounds',
    description:
      'Two sorted integer arrays are given: `nums1` holds `m` meaningful values followed by `n` empty slots (zeros), and `nums2` holds `n` values.\n\n' +
      'Merge `nums2` into `nums1` so that the first `m + n` positions of `nums1` are sorted in non-decreasing order. Do not return anything; modify `nums1` in place.',
    examples: [
      { input: 'nums1 = [1, 2, 3, 0, 0, 0], m = 3, nums2 = [2, 5, 6], n = 3', output: '[1, 2, 2, 3, 5, 6]' },
      { input: 'nums1 = [1], m = 1, nums2 = [], n = 0', output: '[1]', explanation: 'Nothing to merge.' }
    ],
    constraints: ['nums1.length == m + n', 'nums2.length == n', '0 <= m, n <= 200'],
    hints: [
      'Filling from the front overwrites values you still need. Try filling nums1 from the back.',
      'Your loop must keep running until every element of nums2 is placed, including index 0.'
    ],
    starterCode: `class Solution {
    public void merge(int[] nums1, int m, int[] nums2, int n) {
        // Merge nums2 into nums1 in place
    }
}`,
    referenceSolution: `class Solution {
    public void merge(int[] nums1, int m, int[] nums2, int n) {
        int i = m - 1, j = n - 1, k = m + n - 1;
        while (i >= 0 && j >= 0) {
            nums1[k--] = nums1[i] > nums2[j] ? nums1[i--] : nums2[j--];
        }
        while (j >= 0) nums1[k--] = nums2[j--];
    }
}`,
    tests: [
      t('nums1 = [1, 2, 3, 0, 0, 0], m = 3, nums2 = [2, 5, 6], n = 3', '[1, 2, 2, 3, 5, 6]', '{ int[] a = {1, 2, 3, 0, 0, 0}; sol.merge(a, 3, new int[]{2, 5, 6}, 3); DT.out(a); }'),
      t('nums1 = [1], m = 1, nums2 = [], n = 0', '[1]', '{ int[] a = {1}; sol.merge(a, 1, new int[]{}, 0); DT.out(a); }', edge('empty second array', false)),
      t('nums1 = [0], m = 0, nums2 = [1], n = 1', '[1]', '{ int[] a = {0}; sol.merge(a, 0, new int[]{1}, 1); DT.out(a); }', edge('empty first array')),
      t('nums1 = [4, 5, 6, 0, 0, 0], m = 3, nums2 = [1, 2, 3], n = 3', '[1, 2, 3, 4, 5, 6]', '{ int[] a = {4, 5, 6, 0, 0, 0}; sol.merge(a, 3, new int[]{1, 2, 3}, 3); DT.out(a); }', H),
      t('nums1 = [2, 0], m = 1, nums2 = [1], n = 1', '[1, 2]', '{ int[] a = {2, 0}; sol.merge(a, 1, new int[]{1}, 1); DT.out(a); }', H)
    ]
  },
  {
    id: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'Medium',
    topic: 'Arrays',
    focus: ['Loop Logic', 'Array Indexing'],
    mistakeProneArea: 'Two-pointer movement rule',
    description:
      'Each value `height[i]` is the height of a vertical wall standing at x-position `i`. Pick two walls; together with the x-axis they form a container whose capacity is `(j - i) * min(height[i], height[j])`.\n\n' +
      'Return the largest capacity any pair of walls can hold.',
    examples: [
      { input: 'height = [1, 8, 6, 2, 5, 4, 8, 3, 7]', output: '49', explanation: 'Walls at positions 1 and 8: width 7, height min(8, 7) = 7.' },
      { input: 'height = [1, 1]', output: '1' }
    ],
    constraints: ['2 <= height.length <= 10^5', '0 <= height[i] <= 10^4'],
    hints: [
      'Start with the widest container (both ends) and move inwards.',
      'Always move the pointer at the shorter wall; moving the taller one can never help.'
    ],
    starterCode: `class Solution {
    public int maxArea(int[] height) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int maxArea(int[] height) {
        int left = 0, right = height.length - 1, best = 0;
        while (left < right) {
            best = Math.max(best, (right - left) * Math.min(height[left], height[right]));
            if (height[left] < height[right]) left++; else right--;
        }
        return best;
    }
}`,
    tests: [
      t('height = [1, 8, 6, 2, 5, 4, 8, 3, 7]', '49', 'DT.out(sol.maxArea(new int[]{1, 8, 6, 2, 5, 4, 8, 3, 7}));'),
      t('height = [1, 1]', '1', 'DT.out(sol.maxArea(new int[]{1, 1}));', edge('minimum size', false)),
      t('height = [4, 3, 2, 1, 4]', '16', 'DT.out(sol.maxArea(new int[]{4, 3, 2, 1, 4}));', H),
      t('height = [1, 2, 1]', '2', 'DT.out(sol.maxArea(new int[]{1, 2, 1}));', H),
      t('height = [2, 3, 4, 5, 18, 17, 6]', '17', 'DT.out(sol.maxArea(new int[]{2, 3, 4, 5, 18, 17, 6}));', H)
    ]
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topic: 'Arrays',
    focus: ['Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Running-sum reset logic',
    description:
      'Given an integer array `nums`, find the contiguous, non-empty block of elements with the largest total and return that total.',
    examples: [
      { input: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]', output: '6', explanation: 'The block [4, -1, 2, 1] sums to 6.' },
      { input: 'nums = [1]', output: '1' }
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    hints: [
      'At each index decide: extend the current block, or start a new block here?',
      'Initialise your best answer with nums[0], not 0, otherwise all-negative arrays break.'
    ],
    starterCode: `class Solution {
    public int maxSubArray(int[] nums) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int maxSubArray(int[] nums) {
        int best = nums[0], cur = nums[0];
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]);
            best = Math.max(best, cur);
        }
        return best;
    }
}`,
    tests: [
      t('nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]', '6', 'DT.out(sol.maxSubArray(new int[]{-2, 1, -3, 4, -1, 2, 1, -5, 4}));'),
      t('nums = [1]', '1', 'DT.out(sol.maxSubArray(new int[]{1}));', edge('single element', false)),
      t('nums = [5, 4, -1, 7, 8]', '23', 'DT.out(sol.maxSubArray(new int[]{5, 4, -1, 7, 8}));', H),
      t('nums = [-1]', '-1', 'DT.out(sol.maxSubArray(new int[]{-1}));', edge('single negative element')),
      t('nums = [-3, -2, -5]', '-2', 'DT.out(sol.maxSubArray(new int[]{-3, -2, -5}));', edge('all negative values'))
    ]
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Boundary Conditions', 'Loop Logic'],
    mistakeProneArea: 'Boundary elevation tracking',
    description:
      'The array `height` describes a skyline of bars, each of width 1. After rain, water collects in the dips between taller bars.\n\n' +
      'Return the total units of water held by the skyline.',
    examples: [
      { input: 'height = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]', output: '6' },
      { input: 'height = [4, 2, 0, 3, 2, 5]', output: '9' }
    ],
    constraints: ['1 <= height.length <= 2 * 10^4', '0 <= height[i] <= 10^5'],
    hints: [
      'Water above bar i is min(highest bar on the left, highest bar on the right) - height[i].',
      'Two pointers can track leftMax and rightMax without extra arrays.'
    ],
    starterCode: `class Solution {
    public int trap(int[] height) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int trap(int[] height) {
        int left = 0, right = height.length - 1, leftMax = 0, rightMax = 0, total = 0;
        while (left < right) {
            if (height[left] < height[right]) {
                leftMax = Math.max(leftMax, height[left]);
                total += leftMax - height[left++];
            } else {
                rightMax = Math.max(rightMax, height[right]);
                total += rightMax - height[right--];
            }
        }
        return total;
    }
}`,
    tests: [
      t('height = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]', '6', 'DT.out(sol.trap(new int[]{0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1}));'),
      t('height = [4, 2, 0, 3, 2, 5]', '9', 'DT.out(sol.trap(new int[]{4, 2, 0, 3, 2, 5}));'),
      t('height = [3, 0, 2, 0, 4]', '7', 'DT.out(sol.trap(new int[]{3, 0, 2, 0, 4}));', H),
      t('height = [1, 2, 3, 4, 5]', '0', 'DT.out(sol.trap(new int[]{1, 2, 3, 4, 5}));', edge('strictly increasing')),
      t('height = [5]', '0', 'DT.out(sol.trap(new int[]{5}));', edge('single bar'))
    ]
  },
  {
    id: 'running-sum',
    title: 'Prefix Running Total',
    difficulty: 'Easy',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Loop Logic'],
    mistakeProneArea: 'Previous-index access (i - 1)',
    description:
      'Given an integer array `nums`, return a new array `result` of the same length where `result[i]` is the sum of `nums[0]` through `nums[i]` inclusive.',
    examples: [
      { input: 'nums = [1, 2, 3, 4]', output: '[1, 3, 6, 10]', explanation: '1, 1+2, 1+2+3, 1+2+3+4.' },
      { input: 'nums = [3, 1, 2, 10, 1]', output: '[3, 4, 6, 16, 17]' }
    ],
    constraints: ['1 <= nums.length <= 1000', '-10^6 <= nums[i] <= 10^6'],
    hints: [
      'result[i] = result[i - 1] + nums[i]. What is result[0]?',
      'If your loop reads result[i - 1], it must not start at i = 0.'
    ],
    starterCode: `class Solution {
    public int[] runningSum(int[] nums) {
        return new int[0];
    }
}`,
    referenceSolution: `class Solution {
    public int[] runningSum(int[] nums) {
        int[] result = new int[nums.length];
        int sum = 0;
        for (int i = 0; i < nums.length; i++) {
            sum += nums[i];
            result[i] = sum;
        }
        return result;
    }
}`,
    tests: [
      t('nums = [1, 2, 3, 4]', '[1, 3, 6, 10]', 'DT.out(sol.runningSum(new int[]{1, 2, 3, 4}));'),
      t('nums = [3, 1, 2, 10, 1]', '[3, 4, 6, 16, 17]', 'DT.out(sol.runningSum(new int[]{3, 1, 2, 10, 1}));'),
      t('nums = [7]', '[7]', 'DT.out(sol.runningSum(new int[]{7}));', edge('single element')),
      t('nums = [-1, 1, -1, 1]', '[-1, 0, -1, 0]', 'DT.out(sol.runningSum(new int[]{-1, 1, -1, 1}));', edge('negative numbers')),
      t('nums = [0, 0, 0]', '[0, 0, 0]', 'DT.out(sol.runningSum(new int[]{0, 0, 0}));', H)
    ]
  },
  {
    id: 'rotate-array',
    title: 'Rotate Array Right',
    difficulty: 'Medium',
    topic: 'Arrays',
    focus: ['Array Indexing', 'Boundary Conditions'],
    mistakeProneArea: 'Modular index arithmetic',
    description:
      'Rotate the integer array `nums` to the right by `k` positions, in place. Each rotation moves the last element to the front.\n\n' +
      'Note that `k` may be larger than the array length.',
    examples: [
      { input: 'nums = [1, 2, 3, 4, 5, 6, 7], k = 3', output: '[5, 6, 7, 1, 2, 3, 4]' },
      { input: 'nums = [-1, -100, 3, 99], k = 2', output: '[3, 99, -1, -100]' }
    ],
    constraints: ['1 <= nums.length <= 10^5', '0 <= k <= 10^5'],
    hints: [
      'Rotating by k is the same as rotating by k % n.',
      'Reverse the whole array, then reverse the first k elements and the remaining n - k elements.'
    ],
    starterCode: `class Solution {
    public void rotate(int[] nums, int k) {
        // Modify nums in place
    }
}`,
    referenceSolution: `class Solution {
    public void rotate(int[] nums, int k) {
        int n = nums.length;
        k %= n;
        reverse(nums, 0, n - 1);
        reverse(nums, 0, k - 1);
        reverse(nums, k, n - 1);
    }
    private void reverse(int[] a, int i, int j) {
        while (i < j) { int t = a[i]; a[i++] = a[j]; a[j--] = t; }
    }
}`,
    tests: [
      t('nums = [1, 2, 3, 4, 5, 6, 7], k = 3', '[5, 6, 7, 1, 2, 3, 4]', '{ int[] a = {1, 2, 3, 4, 5, 6, 7}; sol.rotate(a, 3); DT.out(a); }'),
      t('nums = [-1, -100, 3, 99], k = 2', '[3, 99, -1, -100]', '{ int[] a = {-1, -100, 3, 99}; sol.rotate(a, 2); DT.out(a); }'),
      t('nums = [1, 2], k = 5', '[2, 1]', '{ int[] a = {1, 2}; sol.rotate(a, 5); DT.out(a); }', edge('k larger than length')),
      t('nums = [1], k = 0', '[1]', '{ int[] a = {1}; sol.rotate(a, 0); DT.out(a); }', edge('single element, k = 0')),
      t('nums = [1, 2, 3], k = 3', '[1, 2, 3]', '{ int[] a = {1, 2, 3}; sol.rotate(a, 3); DT.out(a); }', edge('k equals length')),
      t('nums = [1, 2, 3, 4, 5, 6], k = 4', '[3, 4, 5, 6, 1, 2]', '{ int[] a = {1, 2, 3, 4, 5, 6}; sol.rotate(a, 4); DT.out(a); }', H)
    ]
  },

  // ===================================================================== STRINGS
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topic: 'Strings',
    focus: ['Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'Sliding-window left boundary',
    description:
      'Given a string `s`, return the length of the longest contiguous piece of `s` in which no character appears twice.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: '"abc" is the longest piece without a repeated character.' },
      { input: 's = "bbbbb"', output: '1' }
    ],
    constraints: ['0 <= s.length <= 5 * 10^4', 's contains letters, digits, symbols and spaces.'],
    hints: [
      'Maintain a window [left, right] that never contains a duplicate.',
      'When a repeat is found, the left edge may only move forward, never backward.'
    ],
    starterCode: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> last = new HashMap<>();
        int best = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (last.containsKey(c)) left = Math.max(left, last.get(c) + 1);
            last.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}`,
    tests: [
      t('s = "abcabcbb"', '3', 'DT.out(sol.lengthOfLongestSubstring("abcabcbb"));'),
      t('s = "bbbbb"', '1', 'DT.out(sol.lengthOfLongestSubstring("bbbbb"));'),
      t('s = "pwwkew"', '3', 'DT.out(sol.lengthOfLongestSubstring("pwwkew"));'),
      t('s = ""', '0', 'DT.out(sol.lengthOfLongestSubstring(""));', edge('empty string')),
      t('s = " "', '1', 'DT.out(sol.lengthOfLongestSubstring(" "));', edge('single character')),
      t('s = "abba"', '2', 'DT.out(sol.lengthOfLongestSubstring("abba"));', H)
    ]
  },
  {
    id: 'reverse-words',
    title: 'Reverse Word Order',
    difficulty: 'Medium',
    topic: 'Strings',
    focus: ['Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Leading, trailing & repeated spaces',
    description:
      'A sentence `s` contains words separated by one or more spaces, and may start or end with spaces. Return a string with the words in reverse order, separated by exactly one space, with no leading or trailing spaces.',
    examples: [
      { input: 's = "the sky is blue"', output: '"blue is sky the"' },
      { input: 's = "  hello world  "', output: '"world hello"', explanation: 'Leading and trailing spaces are removed.' }
    ],
    constraints: ['1 <= s.length <= 10^4', 's contains at least one word.'],
    hints: [
      'Splitting on a single space leaves empty strings when spaces repeat. Trim first, then split on one-or-more spaces.',
      'Build the answer with a StringBuilder, adding a space only between words.'
    ],
    starterCode: `class Solution {
    public String reverseWords(String s) {
        return "";
    }
}`,
    referenceSolution: `class Solution {
    public String reverseWords(String s) {
        String[] words = s.trim().split("\\\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            sb.append(words[i]);
            if (i > 0) sb.append(' ');
        }
        return sb.toString();
    }
}`,
    tests: [
      t('s = "the sky is blue"', '"blue is sky the"', 'DT.outStr(sol.reverseWords("the sky is blue"));'),
      t('s = "  hello world  "', '"world hello"', 'DT.outStr(sol.reverseWords("  hello world  "));', edge('leading/trailing spaces', false)),
      t('s = "a good   example"', '"example good a"', 'DT.outStr(sol.reverseWords("a good   example"));', edge('repeated spaces')),
      t('s = "single"', '"single"', 'DT.outStr(sol.reverseWords("single"));', edge('single word')),
      t('s = "  x  "', '"x"', 'DT.outStr(sol.reverseWords("  x  "));', edge('single letter with padding'))
    ]
  },
  {
    id: 'valid-palindrome',
    title: 'Alphanumeric Palindrome',
    difficulty: 'Easy',
    topic: 'Strings',
    focus: ['Array Indexing', 'Boundary Conditions'],
    mistakeProneArea: 'Two-pointer skipping & bounds',
    description:
      'A phrase is a palindrome if, after converting letters to lowercase and discarding every character that is not a letter or digit, it reads the same forwards and backwards.\n\n' +
      'Return `true` if `s` is such a palindrome, otherwise `false`.',
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'true' },
      { input: 's = "race a car"', output: 'false' }
    ],
    constraints: ['1 <= s.length <= 2 * 10^5', 's contains printable ASCII characters.'],
    hints: [
      'Skip characters that are not letters/digits (Java: Character.isLetterOrDigit, Python: str.isalnum, C++: isalnum) and compare lowercase.',
      'When skipping characters with an inner while loop, re-check left < right inside that loop.'
    ],
    starterCode: `class Solution {
    public boolean isPalindrome(String s) {
        return false;
    }
}`,
    referenceSolution: `class Solution {
    public boolean isPalindrome(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            while (i < j && !Character.isLetterOrDigit(s.charAt(i))) i++;
            while (i < j && !Character.isLetterOrDigit(s.charAt(j))) j--;
            if (Character.toLowerCase(s.charAt(i)) != Character.toLowerCase(s.charAt(j))) return false;
            i++; j--;
        }
        return true;
    }
}`,
    tests: [
      t('s = "A man, a plan, a canal: Panama"', 'true', 'DT.out(sol.isPalindrome("A man, a plan, a canal: Panama"));'),
      t('s = "race a car"', 'false', 'DT.out(sol.isPalindrome("race a car"));'),
      t('s = " "', 'true', 'DT.out(sol.isPalindrome(" "));', edge('only spaces')),
      t('s = "a."', 'true', 'DT.out(sol.isPalindrome("a."));', edge('single letter with punctuation')),
      t('s = "0P"', 'false', 'DT.out(sol.isPalindrome("0P"));', H),
      t('s = ".,,"', 'true', 'DT.out(sol.isPalindrome(".,,"));', edge('no alphanumeric characters'))
    ]
  },

  // ===================================================================== HASHING
  {
    id: 'valid-anagram',
    title: 'Anagram Check',
    difficulty: 'Easy',
    topic: 'Hashing',
    focus: ['Array Indexing', 'Boundary Conditions'],
    mistakeProneArea: 'Character-count indexing',
    description:
      'Two strings are anagrams if one can be formed by rearranging all the letters of the other. Given lowercase strings `s` and `t`, return `true` if `t` is an anagram of `s`.',
    examples: [
      { input: 's = "listen", t = "silent"', output: 'true' },
      { input: 's = "rat", t = "car"', output: 'false' }
    ],
    constraints: ['1 <= s.length, t.length <= 5 * 10^4', 's and t contain lowercase English letters only.'],
    hints: [
      'Count how many times each letter appears. An int[26] indexed by (c - \'a\') works well.',
      'Strings of different length can never be anagrams; check that first.'
    ],
    starterCode: `class Solution {
    public boolean isAnagram(String s, String t) {
        return false;
    }
}`,
    referenceSolution: `class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) if (c != 0) return false;
        return true;
    }
}`,
    tests: [
      t('s = "listen", t = "silent"', 'true', 'DT.out(sol.isAnagram("listen", "silent"));'),
      t('s = "rat", t = "car"', 'false', 'DT.out(sol.isAnagram("rat", "car"));'),
      t('s = "a", t = "ab"', 'false', 'DT.out(sol.isAnagram("a", "ab"));', edge('different lengths (t longer)')),
      t('s = "ab", t = "a"', 'false', 'DT.out(sol.isAnagram("ab", "a"));', edge('different lengths (s longer)')),
      t('s = "aacc", t = "ccac"', 'false', 'DT.out(sol.isAnagram("aacc", "ccac"));', H),
      t('s = "x", t = "x"', 'true', 'DT.out(sol.isAnagram("x", "x"));', edge('single character'))
    ]
  },
  {
    id: 'first-unique-char',
    title: 'First Non-Repeating Character',
    difficulty: 'Easy',
    topic: 'Hashing',
    focus: ['Array Indexing', 'Boundary Conditions'],
    mistakeProneArea: 'Frequency map lookups',
    description:
      'Given a lowercase string `s`, return the index of the first character that occurs exactly once in `s`. If every character repeats, return `-1`.',
    examples: [
      { input: 's = "swiss"', output: '1', explanation: '\'w\' (index 1) is the first character that appears exactly once.' },
      { input: 's = "aabb"', output: '-1' }
    ],
    constraints: ['1 <= s.length <= 10^5', 's contains lowercase English letters only.'],
    hints: [
      'Make two passes: one to count every character, one to find the first with count 1.',
      'Remember to return -1 when no such character exists.'
    ],
    starterCode: `class Solution {
    public int firstUniqChar(String s) {
        return -1;
    }
}`,
    referenceSolution: `class Solution {
    public int firstUniqChar(String s) {
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        for (int i = 0; i < s.length(); i++) if (count[s.charAt(i) - 'a'] == 1) return i;
        return -1;
    }
}`,
    tests: [
      t('s = "swiss"', '1', 'DT.out(sol.firstUniqChar("swiss"));'),
      t('s = "aabb"', '-1', 'DT.out(sol.firstUniqChar("aabb"));', edge('no unique character', false)),
      t('s = "z"', '0', 'DT.out(sol.firstUniqChar("z"));', edge('single character')),
      t('s = "loveloop"', '2', 'DT.out(sol.firstUniqChar("loveloop"));', H),
      t('s = "aabbccd"', '6', 'DT.out(sol.firstUniqChar("aabbccd"));', edge('answer at last index'))
    ]
  },
  {
    id: 'longest-consecutive',
    title: 'Longest Consecutive Run',
    difficulty: 'Medium',
    topic: 'Hashing',
    focus: ['Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'Run start detection',
    description:
      'Given an unsorted integer array `nums`, return the length of the longest group of values that form a run of consecutive integers (like 4, 5, 6, 7). The values may appear anywhere in the array. Aim for O(n) time.',
    examples: [
      { input: 'nums = [100, 4, 200, 1, 3, 2]', output: '4', explanation: 'The run 1, 2, 3, 4 has length 4.' },
      { input: 'nums = [0, 3, 7, 2, 5, 8, 4, 6, 0, 1]', output: '9' }
    ],
    constraints: ['0 <= nums.length <= 10^5', '-10^9 <= nums[i] <= 10^9'],
    hints: [
      'Put every value in a hash set (HashSet / set / unordered_set).',
      'Only start counting from x when x - 1 is not in the set; then walk x + 1, x + 2, ...'
    ],
    starterCode: `class Solution {
    public int longestConsecutive(int[] nums) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int x : nums) set.add(x);
        int best = 0;
        for (int x : set) {
            if (set.contains(x - 1)) continue;
            int len = 1;
            while (set.contains(x + len)) len++;
            best = Math.max(best, len);
        }
        return best;
    }
}`,
    tests: [
      t('nums = [100, 4, 200, 1, 3, 2]', '4', 'DT.out(sol.longestConsecutive(new int[]{100, 4, 200, 1, 3, 2}));'),
      t('nums = [0, 3, 7, 2, 5, 8, 4, 6, 0, 1]', '9', 'DT.out(sol.longestConsecutive(new int[]{0, 3, 7, 2, 5, 8, 4, 6, 0, 1}));'),
      t('nums = []', '0', 'DT.out(sol.longestConsecutive(new int[]{}));', edge('empty array')),
      t('nums = [5]', '1', 'DT.out(sol.longestConsecutive(new int[]{5}));', edge('single element')),
      t('nums = [1, 2, 0, 1]', '3', 'DT.out(sol.longestConsecutive(new int[]{1, 2, 0, 1}));', edge('duplicate values')),
      t('nums = [-2, -1, 0, 10]', '3', 'DT.out(sol.longestConsecutive(new int[]{-2, -1, 0, 10}));', H)
    ]
  },

  // ===================================================================== SEARCHING
  {
    id: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    topic: 'Searching',
    focus: ['Boundary Conditions', 'Loop Logic'],
    mistakeProneArea: 'Loop condition (<= vs <) & mid updates',
    description:
      'Given a sorted (ascending) integer array `nums` with distinct values and an integer `target`, return the index of `target` in `nums`, or `-1` if it is absent.\n\n' +
      'Your algorithm must run in O(log n) time.',
    examples: [
      { input: 'nums = [-1, 0, 3, 5, 9, 12], target = 9', output: '4' },
      { input: 'nums = [-1, 0, 3, 5, 9, 12], target = 2', output: '-1' }
    ],
    constraints: ['1 <= nums.length <= 10^4', 'All values in nums are distinct.', 'nums is sorted in ascending order.'],
    hints: [
      'Keep a search range [left, right]. While it is non-empty, compare the middle element.',
      'If your range is inclusive, the loop must be while (left <= right), and the updates must be mid + 1 / mid - 1.'
    ],
    starterCode: `class Solution {
    public int search(int[] nums, int target) {
        return -1;
    }
}`,
    referenceSolution: `class Solution {
    public int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return -1;
    }
}`,
    tests: [
      t('nums = [-1, 0, 3, 5, 9, 12], target = 9', '4', 'DT.out(sol.search(new int[]{-1, 0, 3, 5, 9, 12}, 9));'),
      t('nums = [-1, 0, 3, 5, 9, 12], target = 2', '-1', 'DT.out(sol.search(new int[]{-1, 0, 3, 5, 9, 12}, 2));'),
      t('nums = [5], target = 5', '0', 'DT.out(sol.search(new int[]{5}, 5));', edge('single element', false)),
      t('nums = [2, 5], target = 5', '1', 'DT.out(sol.search(new int[]{2, 5}, 5));', edge('target at last index')),
      t('nums = [1, 3, 5, 7, 9], target = 1', '0', 'DT.out(sol.search(new int[]{1, 3, 5, 7, 9}, 1));', edge('target at first index')),
      t('nums = [1, 3, 5, 7, 9], target = 10', '-1', 'DT.out(sol.search(new int[]{1, 3, 5, 7, 9}, 10));', edge('target beyond range'))
    ]
  },
  {
    id: 'search-insert',
    title: 'Search Insert Position',
    difficulty: 'Easy',
    topic: 'Searching',
    focus: ['Boundary Conditions', 'Loop Logic'],
    mistakeProneArea: 'Insertion at array ends',
    description:
      'Given a sorted array of distinct integers `nums` and a `target`, return the index of `target` if present. Otherwise return the index where `target` would be inserted to keep the array sorted. Use an O(log n) algorithm.',
    examples: [
      { input: 'nums = [1, 3, 5, 6], target = 5', output: '2' },
      { input: 'nums = [1, 3, 5, 6], target = 2', output: '1' }
    ],
    constraints: ['1 <= nums.length <= 10^4', 'nums contains distinct values sorted ascending.'],
    hints: [
      'A standard binary search ends with left pointing at the first element greater than target.',
      'The answer can be nums.length when target is larger than every element.'
    ],
    starterCode: `class Solution {
    public int searchInsert(int[] nums, int target) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int searchInsert(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1; else right = mid - 1;
        }
        return left;
    }
}`,
    tests: [
      t('nums = [1, 3, 5, 6], target = 5', '2', 'DT.out(sol.searchInsert(new int[]{1, 3, 5, 6}, 5));'),
      t('nums = [1, 3, 5, 6], target = 2', '1', 'DT.out(sol.searchInsert(new int[]{1, 3, 5, 6}, 2));'),
      t('nums = [1, 3, 5, 6], target = 7', '4', 'DT.out(sol.searchInsert(new int[]{1, 3, 5, 6}, 7));', edge('insert at end')),
      t('nums = [1, 3, 5, 6], target = 0', '0', 'DT.out(sol.searchInsert(new int[]{1, 3, 5, 6}, 0));', edge('insert at start')),
      t('nums = [1], target = 1', '0', 'DT.out(sol.searchInsert(new int[]{1}, 1));', edge('single element'))
    ]
  },
  {
    id: 'first-last-position',
    title: 'First and Last Occurrence',
    difficulty: 'Medium',
    topic: 'Searching',
    focus: ['Boundary Conditions', 'Loop Logic', 'Array Indexing'],
    mistakeProneArea: 'Biased binary search bounds',
    description:
      'Given an array `nums` sorted in non-decreasing order (duplicates allowed) and a `target`, return `[first, last]`: the first and last indices where `target` appears. Return `[-1, -1]` if it does not appear. Aim for O(log n).',
    examples: [
      { input: 'nums = [5, 7, 7, 8, 8, 10], target = 8', output: '[3, 4]' },
      { input: 'nums = [5, 7, 7, 8, 8, 10], target = 6', output: '[-1, -1]' }
    ],
    constraints: ['0 <= nums.length <= 10^5', 'nums is sorted in non-decreasing order.'],
    hints: [
      'Run binary search twice: once biased to the left, once biased to the right.',
      'An empty array is valid input; make sure you never read nums[0] without checking the length.'
    ],
    starterCode: `class Solution {
    public int[] searchRange(int[] nums, int target) {
        return new int[] { -1, -1 };
    }
}`,
    referenceSolution: `class Solution {
    public int[] searchRange(int[] nums, int target) {
        return new int[] { bound(nums, target, true), bound(nums, target, false) };
    }
    private int bound(int[] nums, int target, boolean first) {
        int lo = 0, hi = nums.length - 1, ans = -1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) { ans = mid; if (first) hi = mid - 1; else lo = mid + 1; }
            else if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return ans;
    }
}`,
    tests: [
      t('nums = [5, 7, 7, 8, 8, 10], target = 8', '[3, 4]', 'DT.out(sol.searchRange(new int[]{5, 7, 7, 8, 8, 10}, 8));'),
      t('nums = [5, 7, 7, 8, 8, 10], target = 6', '[-1, -1]', 'DT.out(sol.searchRange(new int[]{5, 7, 7, 8, 8, 10}, 6));'),
      t('nums = [], target = 0', '[-1, -1]', 'DT.out(sol.searchRange(new int[]{}, 0));', edge('empty array')),
      t('nums = [1], target = 1', '[0, 0]', 'DT.out(sol.searchRange(new int[]{1}, 1));', edge('single element')),
      t('nums = [2, 2, 2, 2], target = 2', '[0, 3]', 'DT.out(sol.searchRange(new int[]{2, 2, 2, 2}, 2));', edge('all elements equal')),
      t('nums = [1, 2, 3], target = 3', '[2, 2]', 'DT.out(sol.searchRange(new int[]{1, 2, 3}, 3));', H)
    ]
  },

  // ===================================================================== SORTING
  {
    id: 'sort-colors',
    title: 'Three-Color Sort',
    difficulty: 'Medium',
    topic: 'Sorting',
    focus: ['Array Indexing', 'Loop Logic'],
    mistakeProneArea: 'Partition pointer updates',
    description:
      'The array `nums` contains only the values 0, 1 and 2. Sort it in place so that all 0s come first, then all 1s, then all 2s.\n\n' +
      'Try to do it in a single pass without calling a library sort.',
    examples: [
      { input: 'nums = [2, 0, 2, 1, 1, 0]', output: '[0, 0, 1, 1, 2, 2]' },
      { input: 'nums = [2, 0, 1]', output: '[0, 1, 2]' }
    ],
    constraints: ['1 <= nums.length <= 300', 'nums[i] is 0, 1 or 2.'],
    hints: [
      'Keep three regions: [0, low) are 0s, [low, mid) are 1s, (high, end] are 2s.',
      'After swapping nums[mid] with nums[high], do not advance mid: the swapped-in value is still unchecked.'
    ],
    starterCode: `class Solution {
    public void sortColors(int[] nums) {
        // Sort in place
    }
}`,
    referenceSolution: `class Solution {
    public void sortColors(int[] nums) {
        int low = 0, mid = 0, high = nums.length - 1;
        while (mid <= high) {
            if (nums[mid] == 0) { int t = nums[low]; nums[low++] = nums[mid]; nums[mid++] = t; }
            else if (nums[mid] == 1) mid++;
            else { int t = nums[high]; nums[high--] = nums[mid]; nums[mid] = t; }
        }
    }
}`,
    tests: [
      t('nums = [2, 0, 2, 1, 1, 0]', '[0, 0, 1, 1, 2, 2]', '{ int[] a = {2, 0, 2, 1, 1, 0}; sol.sortColors(a); DT.out(a); }'),
      t('nums = [2, 0, 1]', '[0, 1, 2]', '{ int[] a = {2, 0, 1}; sol.sortColors(a); DT.out(a); }'),
      t('nums = [0]', '[0]', '{ int[] a = {0}; sol.sortColors(a); DT.out(a); }', edge('single element')),
      t('nums = [2, 2, 2]', '[2, 2, 2]', '{ int[] a = {2, 2, 2}; sol.sortColors(a); DT.out(a); }', edge('all values equal')),
      t('nums = [1, 0]', '[0, 1]', '{ int[] a = {1, 0}; sol.sortColors(a); DT.out(a); }', H),
      t('nums = [2, 1, 0, 0, 1, 2, 0]', '[0, 0, 0, 1, 1, 2, 2]', '{ int[] a = {2, 1, 0, 0, 1, 2, 0}; sol.sortColors(a); DT.out(a); }', H)
    ]
  },
  {
    id: 'merge-intervals',
    title: 'Merge Overlapping Intervals',
    difficulty: 'Medium',
    topic: 'Sorting',
    focus: ['Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Touching & nested intervals',
    description:
      'Each element of `intervals` is a pair `[start, end]`. Merge every group of overlapping intervals (intervals that share at least one point overlap) and return the merged intervals sorted by start.',
    examples: [
      { input: 'intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]', output: '[[1, 6], [8, 10], [15, 18]]' },
      { input: 'intervals = [[1, 4], [4, 5]]', output: '[[1, 5]]', explanation: '[1, 4] and [4, 5] touch at 4, so they merge.' }
    ],
    constraints: ['1 <= intervals.length <= 10^4', '0 <= start <= end <= 10^4'],
    hints: [
      'Sort the intervals by their start value first.',
      'When merging, the new end is max(current end, next end): a later interval can be fully nested.'
    ],
    starterCode: `class Solution {
    public int[][] merge(int[][] intervals) {
        return new int[0][];
    }
}`,
    referenceSolution: `class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] iv : intervals) {
            if (out.isEmpty() || out.get(out.size() - 1)[1] < iv[0]) out.add(new int[] { iv[0], iv[1] });
            else out.get(out.size() - 1)[1] = Math.max(out.get(out.size() - 1)[1], iv[1]);
        }
        return out.toArray(new int[0][]);
    }
}`,
    tests: [
      t('intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]', '[[1, 6], [8, 10], [15, 18]]', 'DT.out(sol.merge(new int[][]{{1, 3}, {2, 6}, {8, 10}, {15, 18}}));'),
      t('intervals = [[1, 4], [4, 5]]', '[[1, 5]]', 'DT.out(sol.merge(new int[][]{{1, 4}, {4, 5}}));', edge('touching intervals', false)),
      t('intervals = [[1, 4]]', '[[1, 4]]', 'DT.out(sol.merge(new int[][]{{1, 4}}));', edge('single interval')),
      t('intervals = [[5, 6], [1, 2]]', '[[1, 2], [5, 6]]', 'DT.out(sol.merge(new int[][]{{5, 6}, {1, 2}}));', H),
      t('intervals = [[1, 10], [2, 3], [4, 5]]', '[[1, 10]]', 'DT.out(sol.merge(new int[][]{{1, 10}, {2, 3}, {4, 5}}));', edge('nested intervals'))
    ]
  },

  // ===================================================================== LINKED LIST
  {
    id: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    topic: 'Linked List',
    focus: ['Null Handling', 'Loop Logic'],
    mistakeProneArea: 'Null guards & pointer rewiring',
    description:
      'Given the `head` of a singly linked list, reverse the direction of every link and return the new head.\n\n' +
      'The list may be empty (`head` is null / None / nullptr).',
    examples: [
      { input: 'head = [1, 2, 3, 4, 5]', output: '[5, 4, 3, 2, 1]' },
      { input: 'head = [1, 2]', output: '[2, 1]' }
    ],
    constraints: ['0 <= number of nodes <= 5000', '-5000 <= Node.val <= 5000'],
    hints: [
      'Track three references: prev, curr and next.',
      'Save curr.next before you overwrite it, and stop when curr becomes null.'
    ],
    starterCode: `/*
 * Definition for singly-linked list (provided by DebugTrack):
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode(int val) { this.val = val; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        return head;
    }
}`,
    referenceSolution: `class Solution {
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
}`,
    tests: [
      t('head = [1, 2, 3, 4, 5]', '[5, 4, 3, 2, 1]', 'DT.outList(sol.reverseList(DT.list(1, 2, 3, 4, 5)));'),
      t('head = [1, 2]', '[2, 1]', 'DT.outList(sol.reverseList(DT.list(1, 2)));'),
      t('head = []', '[]', 'DT.outList(sol.reverseList(DT.list()));', edge('empty list')),
      t('head = [1]', '[1]', 'DT.outList(sol.reverseList(DT.list(1)));', edge('single node'))
    ]
  },
  {
    id: 'middle-of-list',
    title: 'Middle Node of a List',
    difficulty: 'Easy',
    topic: 'Linked List',
    focus: ['Null Handling', 'Loop Logic'],
    mistakeProneArea: 'fast.next null checks',
    description:
      'Given the `head` of a non-empty singly linked list, return the middle node. If the list has an even number of nodes, return the second of the two middle nodes. (The output shows the list starting from the returned node.)',
    examples: [
      { input: 'head = [1, 2, 3, 4, 5]', output: '[3, 4, 5]' },
      { input: 'head = [1, 2, 3, 4, 5, 6]', output: '[4, 5, 6]' }
    ],
    constraints: ['1 <= number of nodes <= 100'],
    hints: [
      'Move a slow pointer one step and a fast pointer two steps at a time.',
      'The loop condition needs both fast != null and fast.next != null.'
    ],
    starterCode: `/*
 * class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
 */
class Solution {
    public ListNode middleNode(ListNode head) {
        return head;
    }
}`,
    referenceSolution: `class Solution {
    public ListNode middleNode(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) { slow = slow.next; fast = fast.next.next; }
        return slow;
    }
}`,
    tests: [
      t('head = [1, 2, 3, 4, 5]', '[3, 4, 5]', 'DT.outList(sol.middleNode(DT.list(1, 2, 3, 4, 5)));'),
      t('head = [1, 2, 3, 4, 5, 6]', '[4, 5, 6]', 'DT.outList(sol.middleNode(DT.list(1, 2, 3, 4, 5, 6)));'),
      t('head = [1]', '[1]', 'DT.outList(sol.middleNode(DT.list(1)));', edge('single node')),
      t('head = [1, 2]', '[2]', 'DT.outList(sol.middleNode(DT.list(1, 2)));', edge('two nodes'))
    ]
  },
  {
    id: 'merge-two-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'Easy',
    topic: 'Linked List',
    focus: ['Null Handling', 'Boundary Conditions'],
    mistakeProneArea: 'Empty-list handling',
    description:
      'Two linked lists `a` and `b` are each sorted in non-decreasing order. Splice their nodes together into one sorted list and return its head. Either list may be empty.',
    examples: [
      { input: 'a = [1, 2, 4], b = [1, 3, 4]', output: '[1, 1, 2, 3, 4, 4]' },
      { input: 'a = [], b = []', output: '[]' }
    ],
    constraints: ['0 <= nodes in each list <= 50', 'Both lists are sorted in non-decreasing order.'],
    hints: [
      'A dummy head node removes most special cases.',
      'When one list runs out, attach the rest of the other list directly.'
    ],
    starterCode: `/*
 * class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
 */
class Solution {
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        return null;
    }
}`,
    referenceSolution: `class Solution {
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0), tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) { tail.next = a; a = a.next; } else { tail.next = b; b = b.next; }
            tail = tail.next;
        }
        tail.next = (a != null) ? a : b;
        return dummy.next;
    }
}`,
    tests: [
      t('a = [1, 2, 4], b = [1, 3, 4]', '[1, 1, 2, 3, 4, 4]', 'DT.outList(sol.mergeTwoLists(DT.list(1, 2, 4), DT.list(1, 3, 4)));'),
      t('a = [], b = []', '[]', 'DT.outList(sol.mergeTwoLists(DT.list(), DT.list()));', edge('both lists empty', false)),
      t('a = [], b = [0]', '[0]', 'DT.outList(sol.mergeTwoLists(DT.list(), DT.list(0)));', edge('first list empty')),
      t('a = [5], b = [1, 2, 3]', '[1, 2, 3, 5]', 'DT.outList(sol.mergeTwoLists(DT.list(5), DT.list(1, 2, 3)));', H),
      t('a = [2], b = []', '[2]', 'DT.outList(sol.mergeTwoLists(DT.list(2), DT.list()));', edge('second list empty'))
    ]
  },
  {
    id: 'remove-nth-from-end',
    title: 'Remove Nth Node From End',
    difficulty: 'Medium',
    topic: 'Linked List',
    focus: ['Null Handling', 'Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Removing the head node',
    description:
      'Given the `head` of a linked list and an integer `n`, remove the `n`-th node counted from the end of the list and return the head of the resulting list.',
    examples: [
      { input: 'head = [1, 2, 3, 4, 5], n = 2', output: '[1, 2, 3, 5]' },
      { input: 'head = [1], n = 1', output: '[]' }
    ],
    constraints: ['1 <= number of nodes <= 30', '1 <= n <= number of nodes'],
    hints: [
      'Advance a lead pointer n steps, then move both pointers until the lead reaches the end.',
      'If n equals the list length, the head itself is removed; a dummy node before head handles this cleanly.'
    ],
    starterCode: `/*
 * class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
 */
class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        return head;
    }
}`,
    referenceSolution: `class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0);
        dummy.next = head;
        ListNode lead = dummy, trail = dummy;
        for (int i = 0; i <= n; i++) lead = lead.next;
        while (lead != null) { lead = lead.next; trail = trail.next; }
        trail.next = trail.next.next;
        return dummy.next;
    }
}`,
    tests: [
      t('head = [1, 2, 3, 4, 5], n = 2', '[1, 2, 3, 5]', 'DT.outList(sol.removeNthFromEnd(DT.list(1, 2, 3, 4, 5), 2));'),
      t('head = [1], n = 1', '[]', 'DT.outList(sol.removeNthFromEnd(DT.list(1), 1));', edge('remove the only node', false)),
      t('head = [1, 2], n = 1', '[1]', 'DT.outList(sol.removeNthFromEnd(DT.list(1, 2), 1));', edge('remove the tail')),
      t('head = [1, 2], n = 2', '[2]', 'DT.outList(sol.removeNthFromEnd(DT.list(1, 2), 2));', edge('remove the head')),
      t('head = [1, 2, 3, 4], n = 3', '[1, 3, 4]', 'DT.outList(sol.removeNthFromEnd(DT.list(1, 2, 3, 4), 3));', H)
    ]
  },

  // ===================================================================== STACK
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topic: 'Stack',
    focus: ['Runtime Errors', 'Boundary Conditions'],
    mistakeProneArea: 'Popping from an empty stack',
    description:
      'A string `s` consists only of the bracket characters `( ) [ ] { }`. It is valid when every opening bracket is closed by the same kind of bracket, closings happen in the correct (nested) order, and no closing bracket appears without a matching opener.\n\n' +
      'Return `true` if `s` is valid.',
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "([)]"', output: 'false', explanation: 'Brackets close in the wrong order.' }
    ],
    constraints: ['1 <= s.length <= 10^4', 's contains only ()[]{}'],
    hints: [
      'Push opening brackets; on a closing bracket, the top of the stack must be its partner.',
      'A closing bracket can arrive when the stack is empty. Check that the stack is not empty before popping.'
    ],
    starterCode: `class Solution {
    public boolean isValid(String s) {
        return false;
    }
}`,
    referenceSolution: `class Solution {
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
}`,
    tests: [
      t('s = "()[]{}"', 'true', 'DT.out(sol.isValid("()[]{}"));'),
      t('s = "(]"', 'false', 'DT.out(sol.isValid("(]"));'),
      t('s = "([)]"', 'false', 'DT.out(sol.isValid("([)]"));'),
      t('s = "{[]}"', 'true', 'DT.out(sol.isValid("{[]}"));', H),
      t('s = "((("', 'false', 'DT.out(sol.isValid("((("));', edge('unclosed brackets')),
      t('s = ")"', 'false', 'DT.out(sol.isValid(")"));', edge('starts with a closing bracket'))
    ]
  },
  {
    id: 'daily-temperatures',
    title: 'Days Until Warmer',
    difficulty: 'Medium',
    topic: 'Stack',
    focus: ['Array Indexing', 'Loop Logic'],
    mistakeProneArea: 'Monotonic stack of indices',
    description:
      '`temps[i]` is the temperature on day `i`. For each day, return how many days you must wait for a strictly warmer temperature. If no warmer day follows, use `0`.',
    examples: [
      { input: 'temps = [73, 74, 75, 71, 69, 72, 76, 73]', output: '[1, 1, 4, 2, 1, 1, 0, 0]' },
      { input: 'temps = [30, 40, 50, 60]', output: '[1, 1, 1, 0]' }
    ],
    constraints: ['1 <= temps.length <= 10^5', '30 <= temps[i] <= 100'],
    hints: [
      'Keep a stack of indices whose answer is still unknown.',
      'Store indices, not temperatures: the answer is the difference between indices.'
    ],
    starterCode: `class Solution {
    public int[] dailyTemperatures(int[] temps) {
        return new int[temps.length];
    }
}`,
    referenceSolution: `class Solution {
    public int[] dailyTemperatures(int[] temps) {
        int[] ans = new int[temps.length];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < temps.length; i++) {
            while (!stack.isEmpty() && temps[stack.peek()] < temps[i]) {
                int j = stack.pop();
                ans[j] = i - j;
            }
            stack.push(i);
        }
        return ans;
    }
}`,
    tests: [
      t('temps = [73, 74, 75, 71, 69, 72, 76, 73]', '[1, 1, 4, 2, 1, 1, 0, 0]', 'DT.out(sol.dailyTemperatures(new int[]{73, 74, 75, 71, 69, 72, 76, 73}));'),
      t('temps = [30, 40, 50, 60]', '[1, 1, 1, 0]', 'DT.out(sol.dailyTemperatures(new int[]{30, 40, 50, 60}));'),
      t('temps = [30, 60, 90]', '[1, 1, 0]', 'DT.out(sol.dailyTemperatures(new int[]{30, 60, 90}));', H),
      t('temps = [50]', '[0]', 'DT.out(sol.dailyTemperatures(new int[]{50}));', edge('single day')),
      t('temps = [80, 70, 60]', '[0, 0, 0]', 'DT.out(sol.dailyTemperatures(new int[]{80, 70, 60}));', edge('strictly decreasing'))
    ]
  },
  {
    id: 'evaluate-postfix',
    title: 'Evaluate Postfix Expression',
    difficulty: 'Medium',
    topic: 'Stack',
    focus: ['Runtime Errors', 'Boundary Conditions'],
    mistakeProneArea: 'Operand order & negative tokens',
    description:
      'An arithmetic expression is given in postfix (Reverse Polish) notation as an array of tokens. Each token is an integer or one of `+ - * /`. Evaluate it and return the result. Division truncates toward zero. The expression is always valid.',
    examples: [
      { input: 'tokens = ["2", "1", "+", "3", "*"]', output: '9', explanation: '(2 + 1) * 3 = 9' },
      { input: 'tokens = ["4", "13", "5", "/", "+"]', output: '6', explanation: '4 + (13 / 5) = 6' }
    ],
    constraints: ['1 <= tokens.length <= 10^4', 'Intermediate results fit in a 32-bit int.'],
    hints: [
      'Push numbers; on an operator pop two values. The first value popped is the RIGHT operand.',
      'A token like "-11" is a number, not the minus operator. Compare whole tokens, not first characters.'
    ],
    starterCode: `class Solution {
    public int evalRPN(String[] tokens) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> st = new ArrayDeque<>();
        for (String tk : tokens) {
            switch (tk) {
                case "+": st.push(st.pop() + st.pop()); break;
                case "-": { int b = st.pop(), a = st.pop(); st.push(a - b); break; }
                case "*": st.push(st.pop() * st.pop()); break;
                case "/": { int b = st.pop(), a = st.pop(); st.push(a / b); break; }
                default: st.push(Integer.parseInt(tk));
            }
        }
        return st.pop();
    }
}`,
    tests: [
      t('tokens = ["2", "1", "+", "3", "*"]', '9', 'DT.out(sol.evalRPN(new String[]{"2", "1", "+", "3", "*"}));'),
      t('tokens = ["4", "13", "5", "/", "+"]', '6', 'DT.out(sol.evalRPN(new String[]{"4", "13", "5", "/", "+"}));'),
      t('tokens = ["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]', '22', 'DT.out(sol.evalRPN(new String[]{"10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"}));', edge('negative operand')),
      t('tokens = ["7"]', '7', 'DT.out(sol.evalRPN(new String[]{"7"}));', edge('single number')),
      t('tokens = ["3", "-4", "-"]', '7', 'DT.out(sol.evalRPN(new String[]{"3", "-4", "-"}));', edge('subtracting a negative'))
    ]
  },

  // ===================================================================== QUEUE
  {
    id: 'recent-requests',
    title: 'Recent Request Counter',
    difficulty: 'Easy',
    topic: 'Queue',
    focus: ['Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'Inclusive window boundary',
    description:
      'A server receives requests at the strictly increasing times (in milliseconds) given by `times`. For each request at time `t`, count how many requests (including itself) happened in the inclusive window `[t - 3000, t]`.\n\n' +
      'Return the counts as an array, one per request.',
    examples: [
      { input: 'times = [1, 100, 3001, 3002]', output: '[1, 2, 3, 3]', explanation: 'At t = 3002 the window is [2, 3002], which excludes the request at time 1.' },
      { input: 'times = [1000, 2000, 3000, 4000, 5000]', output: '[1, 2, 3, 4, 4]' }
    ],
    constraints: ['1 <= times.length <= 10^4', 'times is strictly increasing.'],
    hints: [
      'Use a queue (Java ArrayDeque, Python deque, C++ queue): add each time, then remove times from the front that fall outside the window.',
      'The window is inclusive; a request exactly 3000 ms old still counts.'
    ],
    starterCode: `class Solution {
    public int[] countRecent(int[] times) {
        return new int[times.length];
    }
}`,
    referenceSolution: `class Solution {
    public int[] countRecent(int[] times) {
        int[] out = new int[times.length];
        Queue<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < times.length; i++) {
            q.offer(times[i]);
            while (q.peek() < times[i] - 3000) q.poll();
            out[i] = q.size();
        }
        return out;
    }
}`,
    tests: [
      t('times = [1, 100, 3001, 3002]', '[1, 2, 3, 3]', 'DT.out(sol.countRecent(new int[]{1, 100, 3001, 3002}));'),
      t('times = [1000, 2000, 3000, 4000, 5000]', '[1, 2, 3, 4, 4]', 'DT.out(sol.countRecent(new int[]{1000, 2000, 3000, 4000, 5000}));'),
      t('times = [5]', '[1]', 'DT.out(sol.countRecent(new int[]{5}));', edge('single request')),
      t('times = [1, 3001, 6001]', '[1, 2, 2]', 'DT.out(sol.countRecent(new int[]{1, 3001, 6001}));', edge('request exactly on the window boundary')),
      t('times = [10, 20, 30]', '[1, 2, 3]', 'DT.out(sol.countRecent(new int[]{10, 20, 30}));', H)
    ]
  },
  {
    id: 'round-robin',
    title: 'Round-Robin Scheduler',
    difficulty: 'Medium',
    topic: 'Queue',
    focus: ['Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'Re-queueing unfinished work',
    description:
      'Processes `0 .. n-1` wait in a queue in id order; `burst[i]` is the CPU time process `i` needs. The scheduler repeatedly takes the front process and runs it for `min(quantum, remaining)` time units. If it still needs time, it goes to the back of the queue; otherwise it finishes.\n\n' +
      'Return the process ids in the order they finish.',
    examples: [
      { input: 'burst = [5, 2, 3], quantum = 2', output: '[1, 2, 0]' },
      { input: 'burst = [1, 1, 1], quantum = 5', output: '[0, 1, 2]' }
    ],
    constraints: ['1 <= burst.length <= 1000', '1 <= burst[i], quantum <= 1000'],
    hints: [
      'Store process ids in a Queue and keep a remaining[] array.',
      'A process whose remaining time becomes exactly 0 finishes; it must not be re-queued.'
    ],
    starterCode: `class Solution {
    public int[] finishOrder(int[] burst, int quantum) {
        return new int[burst.length];
    }
}`,
    referenceSolution: `class Solution {
    public int[] finishOrder(int[] burst, int quantum) {
        int[] rem = burst.clone();
        Queue<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < burst.length; i++) q.offer(i);
        int[] order = new int[burst.length];
        int k = 0;
        while (!q.isEmpty()) {
            int p = q.poll();
            rem[p] -= Math.min(quantum, rem[p]);
            if (rem[p] == 0) order[k++] = p; else q.offer(p);
        }
        return order;
    }
}`,
    tests: [
      t('burst = [5, 2, 3], quantum = 2', '[1, 2, 0]', 'DT.out(sol.finishOrder(new int[]{5, 2, 3}, 2));'),
      t('burst = [1, 1, 1], quantum = 5', '[0, 1, 2]', 'DT.out(sol.finishOrder(new int[]{1, 1, 1}, 5));'),
      t('burst = [4], quantum = 1', '[0]', 'DT.out(sol.finishOrder(new int[]{4}, 1));', edge('single process')),
      t('burst = [3, 6, 1], quantum = 3', '[0, 2, 1]', 'DT.out(sol.finishOrder(new int[]{3, 6, 1}, 3));', edge('burst equals quantum')),
      t('burst = [10, 1, 5], quantum = 4', '[1, 2, 0]', 'DT.out(sol.finishOrder(new int[]{10, 1, 5}, 4));', H)
    ]
  },

  // ===================================================================== TREES
  {
    id: 'max-depth',
    title: 'Maximum Depth of a Binary Tree',
    difficulty: 'Easy',
    topic: 'Trees',
    focus: ['Null Handling', 'Runtime Errors'],
    mistakeProneArea: 'Recursive base case',
    description:
      'Return the depth of a binary tree: the number of nodes on the longest path from the root down to a leaf. An empty tree has depth 0.\n\n' +
      'Trees are shown in level order, with `null` marking a missing child.',
    examples: [
      { input: 'root = [3, 9, 20, null, null, 15, 7]', output: '3' },
      { input: 'root = [1, null, 2]', output: '2' }
    ],
    constraints: ['0 <= number of nodes <= 10^4', '-100 <= Node.val <= 100'],
    hints: [
      'depth(node) = 1 + max(depth(node.left), depth(node.right)).',
      'The base case is node == null, which returns 0. Without it, recursion dereferences null.'
    ],
    starterCode: `/*
 * Definition for a binary tree node (provided by DebugTrack):
 * class TreeNode {
 *     int val;
 *     TreeNode left, right;
 *     TreeNode(int val) { this.val = val; }
 * }
 */
class Solution {
    public int maxDepth(TreeNode root) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
    tests: [
      t('root = [3, 9, 20, null, null, 15, 7]', '3', 'DT.out(sol.maxDepth(DT.tree(3, 9, 20, null, null, 15, 7)));'),
      t('root = [1, null, 2]', '2', 'DT.out(sol.maxDepth(DT.tree(1, null, 2)));'),
      t('root = []', '0', 'DT.out(sol.maxDepth(DT.tree()));', edge('empty tree')),
      t('root = [1]', '1', 'DT.out(sol.maxDepth(DT.tree(1)));', edge('single node')),
      t('root = [1, 2, null, 3, null, 4]', '4', 'DT.out(sol.maxDepth(DT.tree(1, 2, null, 3, null, 4)));', edge('skewed tree'))
    ]
  },
  {
    id: 'level-order',
    title: 'Level-by-Level Traversal',
    difficulty: 'Medium',
    topic: 'Trees',
    focus: ['Null Handling', 'Loop Logic'],
    mistakeProneArea: 'Per-level queue sizing',
    description:
      'Return the values of a binary tree grouped by level, from top to bottom and left to right within each level.',
    examples: [
      { input: 'root = [3, 9, 20, null, null, 15, 7]', output: '[[3], [9, 20], [15, 7]]' },
      { input: 'root = [1]', output: '[[1]]' }
    ],
    constraints: ['0 <= number of nodes <= 2000'],
    hints: [
      'Use a Queue for breadth-first search.',
      'Read queue.size() once at the start of each level; the size changes while you add children.'
    ],
    starterCode: `/*
 * class TreeNode { int val; TreeNode left, right; TreeNode(int val) { this.val = val; } }
 */
class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        return new ArrayList<>();
    }
}`,
    referenceSolution: `class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> out = new ArrayList<>();
        if (root == null) return out;
        Queue<TreeNode> q = new ArrayDeque<>();
        q.offer(root);
        while (!q.isEmpty()) {
            int size = q.size();
            List<Integer> level = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                TreeNode n = q.poll();
                level.add(n.val);
                if (n.left != null) q.offer(n.left);
                if (n.right != null) q.offer(n.right);
            }
            out.add(level);
        }
        return out;
    }
}`,
    tests: [
      t('root = [3, 9, 20, null, null, 15, 7]', '[[3], [9, 20], [15, 7]]', 'DT.out(sol.levelOrder(DT.tree(3, 9, 20, null, null, 15, 7)));'),
      t('root = [1]', '[[1]]', 'DT.out(sol.levelOrder(DT.tree(1)));', edge('single node', false)),
      t('root = []', '[]', 'DT.out(sol.levelOrder(DT.tree()));', edge('empty tree')),
      t('root = [1, 2, 3, 4, null, null, 5]', '[[1], [2, 3], [4, 5]]', 'DT.out(sol.levelOrder(DT.tree(1, 2, 3, 4, null, null, 5)));', H)
    ]
  },
  {
    id: 'path-sum',
    title: 'Root-to-Leaf Target Sum',
    difficulty: 'Easy',
    topic: 'Trees',
    focus: ['Null Handling', 'Boundary Conditions'],
    mistakeProneArea: 'Leaf detection',
    description:
      'Return `true` if the binary tree has a path from the root down to a leaf (a node with no children) whose values add up to `target`.',
    examples: [
      { input: 'root = [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1], target = 22', output: 'true', explanation: '5 + 4 + 11 + 2 = 22.' },
      { input: 'root = [1, 2, 3], target = 5', output: 'false' }
    ],
    constraints: ['0 <= number of nodes <= 5000', '-1000 <= Node.val, target <= 1000'],
    hints: [
      'Subtract each node\'s value from target as you go down.',
      'Only a leaf may end a path. A node with one child is not a leaf, and an empty tree has no paths.'
    ],
    starterCode: `/*
 * class TreeNode { int val; TreeNode left, right; TreeNode(int val) { this.val = val; } }
 */
class Solution {
    public boolean hasPathSum(TreeNode root, int target) {
        return false;
    }
}`,
    referenceSolution: `class Solution {
    public boolean hasPathSum(TreeNode root, int target) {
        if (root == null) return false;
        if (root.left == null && root.right == null) return root.val == target;
        return hasPathSum(root.left, target - root.val) || hasPathSum(root.right, target - root.val);
    }
}`,
    tests: [
      t('root = [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1], target = 22', 'true', 'DT.out(sol.hasPathSum(DT.tree(5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1), 22));'),
      t('root = [1, 2, 3], target = 5', 'false', 'DT.out(sol.hasPathSum(DT.tree(1, 2, 3), 5));'),
      t('root = [], target = 0', 'false', 'DT.out(sol.hasPathSum(DT.tree(), 0));', edge('empty tree')),
      t('root = [1, 2], target = 1', 'false', 'DT.out(sol.hasPathSum(DT.tree(1, 2), 1));', edge('root is not a leaf')),
      t('root = [-2, null, -3], target = -5', 'true', 'DT.out(sol.hasPathSum(DT.tree(-2, null, -3), -5));', edge('negative values'))
    ]
  },

  // ===================================================================== GRAPHS
  {
    id: 'number-of-islands',
    title: 'Count Islands',
    difficulty: 'Medium',
    topic: 'Graphs',
    focus: ['Array Indexing', 'Runtime Errors'],
    mistakeProneArea: 'Grid bounds in DFS/BFS',
    description:
      'A grid of characters contains `\'1\'` (land) and `\'0\'` (water). An island is a group of land cells connected horizontally or vertically (not diagonally). Return the number of islands.',
    examples: [
      { input: 'grid = ["11110", "11010", "11000", "00000"]', output: '1' },
      { input: 'grid = ["11000", "11000", "00100", "00011"]', output: '3' }
    ],
    constraints: ['1 <= rows, cols <= 300', 'grid[r][c] is \'0\' or \'1\''],
    hints: [
      'Scan every cell; when you find unvisited land, flood-fill the whole island and count one.',
      'Check r >= 0, r < rows, c >= 0, c < cols BEFORE reading grid[r][c].'
    ],
    starterCode: `class Solution {
    public int numIslands(char[][] grid) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
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
}`,
    tests: [
      t('grid = ["11110", "11010", "11000", "00000"]', '1', 'DT.out(sol.numIslands(DT.grid("11110", "11010", "11000", "00000")));'),
      t('grid = ["11000", "11000", "00100", "00011"]', '3', 'DT.out(sol.numIslands(DT.grid("11000", "11000", "00100", "00011")));'),
      t('grid = ["0"]', '0', 'DT.out(sol.numIslands(DT.grid("0")));', edge('no land')),
      t('grid = ["1"]', '1', 'DT.out(sol.numIslands(DT.grid("1")));', edge('single cell island')),
      t('grid = ["101", "010", "101"]', '5', 'DT.out(sol.numIslands(DT.grid("101", "010", "101")));', edge('diagonal cells do not connect')),
      t('grid = ["111", "111"]', '1', 'DT.out(sol.numIslands(DT.grid("111", "111")));', H)
    ]
  },
  {
    id: 'count-components',
    title: 'Connected Components',
    difficulty: 'Medium',
    topic: 'Graphs',
    focus: ['Loop Logic', 'Array Indexing'],
    mistakeProneArea: 'Visited tracking',
    description:
      'An undirected graph has `n` nodes labelled `0` to `n - 1` and the given list of `edges`. Return the number of connected components (groups of nodes reachable from each other).',
    examples: [
      { input: 'n = 5, edges = [[0, 1], [1, 2], [3, 4]]', output: '2' },
      { input: 'n = 5, edges = [[0, 1], [1, 2], [2, 3], [3, 4]]', output: '1' }
    ],
    constraints: ['1 <= n <= 2000', '0 <= edges.length <= 5000'],
    hints: [
      'Build an adjacency list, then run DFS/BFS from every unvisited node.',
      'Isolated nodes with no edges are components too.'
    ],
    starterCode: `class Solution {
    public int countComponents(int n, int[][] edges) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
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
        while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
        return x;
    }
}`,
    tests: [
      t('n = 5, edges = [[0, 1], [1, 2], [3, 4]]', '2', 'DT.out(sol.countComponents(5, new int[][]{{0, 1}, {1, 2}, {3, 4}}));'),
      t('n = 5, edges = [[0, 1], [1, 2], [2, 3], [3, 4]]', '1', 'DT.out(sol.countComponents(5, new int[][]{{0, 1}, {1, 2}, {2, 3}, {3, 4}}));'),
      t('n = 3, edges = []', '3', 'DT.out(sol.countComponents(3, new int[][]{}));', edge('no edges')),
      t('n = 1, edges = []', '1', 'DT.out(sol.countComponents(1, new int[][]{}));', edge('single node')),
      t('n = 4, edges = [[0, 1], [1, 0], [2, 3]]', '2', 'DT.out(sol.countComponents(4, new int[][]{{0, 1}, {1, 0}, {2, 3}}));', edge('duplicate edges'))
    ]
  },
  {
    id: 'shortest-path',
    title: 'Fewest Hops Between Nodes',
    difficulty: 'Medium',
    topic: 'Graphs',
    focus: ['Loop Logic', 'Boundary Conditions'],
    mistakeProneArea: 'BFS distance & unreachable nodes',
    description:
      'An undirected, unweighted graph has `n` nodes (`0 .. n-1`) and the given `edges`. Return the minimum number of edges on a path from `start` to `end`, or `-1` if `end` cannot be reached.',
    examples: [
      { input: 'n = 6, edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]], start = 0, end = 5', output: '3' },
      { input: 'n = 4, edges = [[0, 1], [2, 3]], start = 0, end = 3', output: '-1' }
    ],
    constraints: ['1 <= n <= 10^4', '0 <= start, end < n'],
    hints: [
      'Breadth-first search visits nodes in order of distance.',
      'Mark nodes visited when you enqueue them, and handle start == end.'
    ],
    starterCode: `class Solution {
    public int fewestHops(int n, int[][] edges, int start, int end) {
        return -1;
    }
}`,
    referenceSolution: `class Solution {
    public int fewestHops(int n, int[][] edges, int start, int end) {
        List<List<Integer>> adj = new ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
        for (int[] e : edges) { adj.get(e[0]).add(e[1]); adj.get(e[1]).add(e[0]); }
        int[] dist = new int[n];
        Arrays.fill(dist, -1);
        dist[start] = 0;
        Queue<Integer> q = new ArrayDeque<>();
        q.offer(start);
        while (!q.isEmpty()) {
            int u = q.poll();
            for (int v : adj.get(u)) if (dist[v] == -1) { dist[v] = dist[u] + 1; q.offer(v); }
        }
        return dist[end];
    }
}`,
    tests: [
      t('n = 6, edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]], start = 0, end = 5', '3', 'DT.out(sol.fewestHops(6, new int[][]{{0, 1}, {0, 2}, {1, 3}, {2, 4}, {3, 5}, {4, 5}}, 0, 5));'),
      t('n = 4, edges = [[0, 1], [2, 3]], start = 0, end = 3', '-1', 'DT.out(sol.fewestHops(4, new int[][]{{0, 1}, {2, 3}}, 0, 3));', edge('unreachable target', false)),
      t('n = 3, edges = [[0, 1], [1, 2]], start = 1, end = 1', '0', 'DT.out(sol.fewestHops(3, new int[][]{{0, 1}, {1, 2}}, 1, 1));', edge('start equals end')),
      t('n = 2, edges = [[0, 1]], start = 0, end = 1', '1', 'DT.out(sol.fewestHops(2, new int[][]{{0, 1}}, 0, 1));', H),
      t('n = 5, edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]], start = 0, end = 3', '2', 'DT.out(sol.fewestHops(5, new int[][]{{0, 1}, {1, 2}, {2, 3}, {3, 4}, {0, 4}}, 0, 3));', H)
    ]
  },

  // ===================================================================== DYNAMIC PROGRAMMING
  {
    id: 'climbing-stairs',
    title: 'Staircase Ways',
    difficulty: 'Easy',
    topic: 'Dynamic Programming',
    focus: ['Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Base cases & dp array size',
    description:
      'You climb a staircase of `n` steps, taking either 1 or 2 steps at a time. Return the number of distinct sequences of moves that reach the top.',
    examples: [
      { input: 'n = 2', output: '2', explanation: '1+1 or 2.' },
      { input: 'n = 3', output: '3', explanation: '1+1+1, 1+2, 2+1.' }
    ],
    constraints: ['1 <= n <= 45'],
    hints: [
      'ways(n) = ways(n - 1) + ways(n - 2).',
      'Plain recursion repeats work exponentially; store results (DP) or keep two variables. If you allocate dp[n], index n is out of range.'
    ],
    starterCode: `class Solution {
    public int climbStairs(int n) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int climbStairs(int n) {
        int a = 1, b = 1;
        for (int i = 2; i <= n; i++) { int c = a + b; a = b; b = c; }
        return b;
    }
}`,
    tests: [
      t('n = 2', '2', 'DT.out(sol.climbStairs(2));'),
      t('n = 3', '3', 'DT.out(sol.climbStairs(3));'),
      t('n = 1', '1', 'DT.out(sol.climbStairs(1));', edge('n = 1')),
      t('n = 5', '8', 'DT.out(sol.climbStairs(5));', H),
      t('n = 45', '1836311903', 'DT.out(sol.climbStairs(45));', edge('largest n (needs DP, not plain recursion)'))
    ]
  },
  {
    id: 'house-robber',
    title: 'Non-Adjacent Maximum Sum',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    focus: ['Boundary Conditions', 'Array Indexing'],
    mistakeProneArea: 'Small-input base cases',
    description:
      'Houses along a street hold the amounts of money in `nums`. You may take money from any set of houses as long as no two chosen houses are next to each other. Return the maximum total you can collect.',
    examples: [
      { input: 'nums = [1, 2, 3, 1]', output: '4', explanation: 'Take houses 0 and 2: 1 + 3.' },
      { input: 'nums = [2, 7, 9, 3, 1]', output: '12', explanation: 'Take houses 0, 2 and 4: 2 + 9 + 1.' }
    ],
    constraints: ['1 <= nums.length <= 100', '0 <= nums[i] <= 400'],
    hints: [
      'best[i] = max(best[i - 1], best[i - 2] + nums[i]).',
      'Arrays of length 1 or 2 are valid input. Do not read nums[1] unconditionally.'
    ],
    starterCode: `class Solution {
    public int rob(int[] nums) {
        return 0;
    }
}`,
    referenceSolution: `class Solution {
    public int rob(int[] nums) {
        int prev = 0, cur = 0;
        for (int x : nums) { int next = Math.max(cur, prev + x); prev = cur; cur = next; }
        return cur;
    }
}`,
    tests: [
      t('nums = [1, 2, 3, 1]', '4', 'DT.out(sol.rob(new int[]{1, 2, 3, 1}));'),
      t('nums = [2, 7, 9, 3, 1]', '12', 'DT.out(sol.rob(new int[]{2, 7, 9, 3, 1}));'),
      t('nums = [5]', '5', 'DT.out(sol.rob(new int[]{5}));', edge('single house')),
      t('nums = [2, 1]', '2', 'DT.out(sol.rob(new int[]{2, 1}));', edge('two houses')),
      t('nums = [2, 1, 1, 2]', '4', 'DT.out(sol.rob(new int[]{2, 1, 1, 2}));', H),
      t('nums = [0, 0, 0]', '0', 'DT.out(sol.rob(new int[]{0, 0, 0}));', edge('all zero'))
    ]
  },
  {
    id: 'coin-change',
    title: 'Fewest Coins',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    focus: ['Boundary Conditions', 'Loop Logic'],
    mistakeProneArea: 'Unreachable amounts & amount = 0',
    description:
      'Given coin denominations `coins` (unlimited supply of each) and a target `amount`, return the fewest coins that add up exactly to `amount`. Return `-1` if it cannot be done, and `0` when `amount` is 0.',
    examples: [
      { input: 'coins = [1, 2, 5], amount = 11', output: '3', explanation: '5 + 5 + 1.' },
      { input: 'coins = [2], amount = 3', output: '-1' }
    ],
    constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 10^4', '0 <= amount <= 10^4'],
    hints: [
      'dp[a] = fewest coins for amount a; dp[0] = 0.',
      'Initialise unreachable amounts with a sentinel (e.g. amount + 1) instead of the largest integer, so adding 1 cannot overflow.'
    ],
    starterCode: `class Solution {
    public int coinChange(int[] coins, int amount) {
        return -1;
    }
}`,
    referenceSolution: `class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int a = 1; a <= amount; a++)
            for (int c : coins) if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
        return dp[amount] > amount ? -1 : dp[amount];
    }
}`,
    tests: [
      t('coins = [1, 2, 5], amount = 11', '3', 'DT.out(sol.coinChange(new int[]{1, 2, 5}, 11));'),
      t('coins = [2], amount = 3', '-1', 'DT.out(sol.coinChange(new int[]{2}, 3));', edge('impossible amount', false)),
      t('coins = [1], amount = 0', '0', 'DT.out(sol.coinChange(new int[]{1}, 0));', edge('amount is zero')),
      t('coins = [3, 7], amount = 20', '4', 'DT.out(sol.coinChange(new int[]{3, 7}, 20));', H),
      t('coins = [2, 5, 10], amount = 27', '4', 'DT.out(sol.coinChange(new int[]{2, 5, 10}, 27));', H)
    ]
  }
];

// Assign stable numeric display IDs (#1, #2, ...), per-problem test ids, the language-neutral
// signature, and each test's argument values (used to generate Python / C++ test calls).
const { SIGNATURES, parseJavaCall } = require('./signatures');
PROBLEMS.forEach((p, idx) => {
  p.number = idx + 1;
  p.signature = SIGNATURES[p.id];
  if (!p.signature) throw new Error(`Missing signature for problem ${p.id}`);
  p.tests.forEach((tc, i) => {
    tc.id = i + 1;
    tc.hidden = !!tc.hidden;
    tc.args = parseJavaCall(tc.call, p.signature);
  });
});

module.exports = { PROBLEMS };
