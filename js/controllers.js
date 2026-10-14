/**
 * DebugTrack - Application Controllers
 * Every view loads its data from the Express REST API for the logged-in user and
 * exposes explicit loading / error / empty states.
 */

// Builds a { loading, error } state object and a loader that fills it
function viewState() {
  return { loading: true, error: null };
}

// Global App Shell Controller (sidebar, navbar, search, settings, notifications)
app.controller('MainController', ['$scope', '$rootScope', '$location', 'AuthService', 'ApiService', 'SettingsService', 'ToastService',
function($scope, $rootScope, $location, AuthService, ApiService, SettingsService, ToastService) {
  $scope.mobileSidebarOpen = false;
  $scope.searchModalOpen = false;
  $scope.settingsModalOpen = false;
  $scope.notifDropdownOpen = false;
  $scope.search = { query: '' };
  $scope.shell = { totalMistakes: 0, streak: 0, notifications: [] };
  $scope.searchProblems = [];

  function loadShell() {
    if (!AuthService.isAuthenticated()) return;
    ApiService.getDashboard().then(function(d) {
      $scope.shell.totalMistakes = d.mistakeSummary.totalMistakes;
      $scope.shell.streak = d.streak;
      $scope.shell.notifications = d.notifications.map(function(n) {
        const prev = ($scope.shell.notifications || []).find(function(p) { return p.id === n.id && p.message === n.message; });
        return angular.extend(n, { read: prev ? prev.read : false });
      });
    }).catch(angular.noop);
    SettingsService.load().catch(angular.noop);
  }

  loadShell();
  $scope.$on('auth:changed', loadShell);
  $scope.$on('data:changed', loadShell);

  $scope.isActive = function(path) {
    if (path === '/') return $location.path() === '/';
    return $location.path().indexOf(path) === 0;
  };

  $scope.toggleMobileSidebar = function() { $scope.mobileSidebarOpen = !$scope.mobileSidebarOpen; };
  $scope.closeMobileSidebar = function() { $scope.mobileSidebarOpen = false; };

  // ---- Quick search (Ctrl/Cmd + K)
  $scope.toggleSearchModal = function() {
    $scope.searchModalOpen = !$scope.searchModalOpen;
    $scope.search.query = '';
    if ($scope.searchModalOpen && !$scope.searchProblems.length) {
      ApiService.getProblems().then(function(d) { $scope.searchProblems = d.problems; })
        .catch(function(err) { ToastService.error(ApiService.errorMessage(err)); });
    }
  };
  $scope.searchFilter = function(p) {
    const q = ($scope.search.query || '').toLowerCase().trim();
    if (!q) return true;
    return p.title.toLowerCase().indexOf(q) !== -1 || p.topic.toLowerCase().indexOf(q) !== -1 || String(p.number) === q.replace('#', '');
  };
  $scope.quickJumpProblem = function(id) {
    $scope.searchModalOpen = false;
    $location.path('/solve/' + id);
  };
  document.addEventListener('keydown', function(e) {
    if (!AuthService.isAuthenticated()) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $scope.$apply($scope.toggleSearchModal);
    } else if (e.key === 'Escape') {
      $scope.$apply(function() {
        $scope.searchModalOpen = false;
        $scope.settingsModalOpen = false;
        $scope.notifDropdownOpen = false;
        $rootScope.$broadcast('modal:escape'); // page-level dialogs close themselves
      });
    }
  });

  // ---- Notifications (derived from the dashboard endpoint)
  $scope.toggleNotifDropdown = function() { $scope.notifDropdownOpen = !$scope.notifDropdownOpen; };
  $scope.markAllNotifsRead = function() {
    $scope.shell.notifications.forEach(function(n) { n.read = true; });
  };
  $scope.unreadNotifCount = function() {
    return $scope.shell.notifications.filter(function(n) { return !n.read; }).length;
  };
  $scope.openNotification = function(n) {
    n.read = true;
    $scope.notifDropdownOpen = false;
    if (n.problemId) $location.path('/solve/' + n.problemId);
    else if (n.id === 'mistake') $location.path('/mistakes');
  };

  // ---- Settings modal
  $scope.toggleSettingsModal = function() {
    $scope.settingsModalOpen = !$scope.settingsModalOpen;
    if ($scope.settingsModalOpen) {
      $scope.settingsForm = angular.copy($rootScope.editorSettings);
      $scope.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      $scope.passwordErrors = {};
      $scope.settingsTab = 'editor';
    }
  };
  $scope.saveSettings = function() {
    $scope.savingSettings = true;
    SettingsService.save({
      editorFontSize: Number($scope.settingsForm.editorFontSize),
      tabSize: Number($scope.settingsForm.tabSize),
      wordWrap: !!$scope.settingsForm.wordWrap,
      minimap: !!$scope.settingsForm.minimap,
      showDiagnostics: !!$scope.settingsForm.showDiagnostics,
      defaultLanguage: $scope.settingsForm.defaultLanguage
    }).then(function() {
      $scope.settingsModalOpen = false;
      ToastService.success('Preferences saved.');
    }).catch(function(err) {
      ToastService.error(ApiService.errorMessage(err, 'Could not save preferences.'));
    }).finally(function() { $scope.savingSettings = false; });
  };
  $scope.changePassword = function() {
    $scope.passwordErrors = {};
    const f = $scope.passwordForm;
    if (!f.currentPassword) $scope.passwordErrors.currentPassword = 'Enter your current password.';
    if (!f.newPassword || f.newPassword.length < 8) $scope.passwordErrors.newPassword = 'New password must be at least 8 characters.';
    if (f.newPassword !== f.confirmPassword) $scope.passwordErrors.confirmPassword = 'Passwords do not match.';
    if (Object.keys($scope.passwordErrors).length) return;
    $scope.changingPassword = true;
    ApiService.changePassword(f).then(function() {
      $scope.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      ToastService.success('Password changed successfully.');
    }).catch(function(err) {
      $scope.passwordErrors = (err.data && err.data.fields) || {};
      ToastService.error(ApiService.errorMessage(err, 'Could not change password.'));
    }).finally(function() { $scope.changingPassword = false; });
  };

  // ---- Logout
  $scope.logout = function() {
    AuthService.clear();
    SettingsService.reset();
    $scope.shell = { totalMistakes: 0, streak: 0, notifications: [] };
    $scope.searchProblems = [];
    $scope.settingsModalOpen = false;
    $scope.notifDropdownOpen = false;
    $scope.mobileSidebarOpen = false;
    $location.path('/login').search({});
    ToastService.info('You have been logged out.');
  };
}]);

// Login & Registration
app.controller('AuthController', ['$scope', '$location', 'AuthService', 'ApiService', 'ToastService',
function($scope, $location, AuthService, ApiService, ToastService) {
  $scope.isRegister = $location.path() === '/register';
  $scope.form = { name: '', email: '', password: '', confirmPassword: '' };
  $scope.errors = {};
  $scope.submitting = false;
  $scope.showPassword = false;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate() {
    const e = {};
    const f = $scope.form;
    if ($scope.isRegister) {
      if (!f.name || f.name.trim().length < 2) e.name = 'Please enter your name (at least 2 characters).';
    }
    if (!f.email) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Please enter a valid email address.';
    if (!f.password) e.password = 'Password is required.';
    else if ($scope.isRegister) {
      if (f.password.length < 8) e.password = 'Password must be at least 8 characters long.';
      else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'Password must contain at least one letter and one number.';
      if (!f.confirmPassword) e.confirmPassword = 'Please confirm your password.';
      else if (f.password !== f.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    }
    return e;
  }

  $scope.submit = function() {
    $scope.formError = null;
    $scope.errors = validate();
    if (Object.keys($scope.errors).length) return;
    $scope.submitting = true;
    const f = $scope.form;
    const request = $scope.isRegister
      ? AuthService.register({ name: f.name.trim(), email: f.email.trim(), password: f.password, confirmPassword: f.confirmPassword })
      : AuthService.login(f.email.trim(), f.password);
    request.then(function(user) {
      ToastService.success($scope.isRegister ? 'Welcome to DebugTrack, ' + user.firstName + '!' : 'Welcome back, ' + user.firstName + '!');
      $location.path('/').search({});
    }).catch(function(err) {
      $scope.errors = (err.data && err.data.fields) || {};
      $scope.formError = ApiService.errorMessage(err, $scope.isRegister ? 'Registration failed.' : 'Login failed.');
    }).finally(function() { $scope.submitting = false; });
  };

  // Google Identity Services renders its own button; the callback runs outside Angular's digest
  $scope.googleEnabled = false;
  function renderGoogleButton(clientId, attempt) {
    const el = document.getElementById('google-signin-button');
    if (!el) return;
    if (!(window.google && google.accounts && google.accounts.id)) {
      // The GIS script loads async; give it a few seconds before giving up
      if (attempt < 20) setTimeout(function() { renderGoogleButton(clientId, attempt + 1); }, 250);
      else $scope.$applyAsync(function() { $scope.googleEnabled = false; });
      return;
    }
    google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential, ux_mode: 'popup' });
    google.accounts.id.renderButton(el, {
      theme: 'filled_black', size: 'large', shape: 'pill', width: 320,
      text: $scope.isRegister ? 'signup_with' : 'signin_with'
    });
  }

  function onGoogleCredential(response) {
    $scope.$apply(function() {
      $scope.formError = null;
      $scope.errors = {};
      $scope.submitting = true;
    });
    AuthService.loginWithGoogle(response.credential).then(function(result) {
      ToastService.success(result.created ? 'Welcome to DebugTrack, ' + result.user.firstName + '!' : 'Welcome back, ' + result.user.firstName + '!');
      $location.path('/').search({});
    }).catch(function(err) {
      $scope.formError = ApiService.errorMessage(err, 'Google sign-in failed.');
    }).finally(function() { $scope.submitting = false; });
  }

  AuthService.getGoogleClientId().then(function(clientId) {
    if (!clientId) return;
    $scope.googleEnabled = true;
    // Wait for ng-if to put the container in the DOM
    setTimeout(function() { renderGoogleButton(clientId, 0); });
  });

  $scope.useDemo = function() {
    $scope.form.email = 'demo@debugtrack.dev';
    $scope.form.password = 'Demo@1234';
  };
}]);

// 1. Dashboard
app.controller('DashboardController', ['$scope', '$location', 'ApiService', 'ChartTheme',
function($scope, $location, ApiService, ChartTheme) {
  $scope.state = viewState();
  $scope.user = $scope.currentUser || {};

  const hour = new Date().getHours();
  $scope.timeGreeting = hour >= 4 && hour < 12 ? 'Good morning' : hour < 17 && hour >= 12 ? 'Good afternoon' : hour < 22 && hour >= 17 ? 'Good evening' : 'Welcome back';

  $scope.load = function() {
    $scope.state = viewState();
    ApiService.getDashboard().then(function(d) {
      $scope.d = d;
      $scope.namedCategories = d.categories.filter(function(c) { return c.name !== 'Unclassified' || c.count > 0; });
      $scope.maxCategoryCount = Math.max.apply(null, d.categories.map(function(c) { return c.count; }).concat([1]));
      $scope.progressChartConfig = {
        type: 'line',
        data: {
          labels: d.weekly.map(function(w) { return w.label; }),
          datasets: [
            { label: 'Problems solved (cumulative)', data: d.weekly.map(function(w) { return w.solvedCumulative; }), borderColor: ChartTheme.palette.cyan, backgroundColor: 'rgba(6,182,212,0.12)', fill: true, tension: 0.3, yAxisID: 'y' },
            { label: 'Mistakes that week', data: d.weekly.map(function(w) { return w.mistakes; }), borderColor: ChartTheme.palette.rose, backgroundColor: ChartTheme.palette.rose, tension: 0.3, borderDash: [5, 4], yAxisID: 'y' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: ChartTheme.legend(true), tooltip: ChartTheme.tooltip }, scales: ChartTheme.axes() }
      };
      $scope.state.loading = false;
    }).catch(function(err) {
      $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load your dashboard.') };
    });
  };
  $scope.load();

  $scope.practiceWeakArea = function() {
    const rec = $scope.d && $scope.d.recommendations[0];
    if (rec) $location.path('/solve/' + rec.problemId);
    else $location.path('/problems');
  };
  $scope.solveProblem = function(id) { $location.path('/solve/' + id); };
}]);

// 2. Problems Catalogue
app.controller('ProblemsController', ['$scope', '$location', 'ApiService',
function($scope, $location, ApiService) {
  const query = $location.search();
  $scope.state = viewState();
  $scope.problems = [];
  $scope.filters = {
    search: query.search || '',
    difficulty: query.difficulty || 'All',
    topic: query.topic || 'All',
    status: query.status || 'All',
    recommendedOnly: query.recommended === 'true'
  };
  $scope.difficulties = ['All', 'Easy', 'Medium', 'Hard'];
  $scope.statuses = ['All', 'Solved', 'Attempted', 'Not Started'];
  $scope.topics = ['All'];

  $scope.load = function() {
    $scope.state = viewState();
    ApiService.getProblems().then(function(d) {
      $scope.problems = d.problems;
      $scope.topics = ['All'].concat(d.topics);
      $scope.counts = {
        solved: d.problems.filter(function(p) { return p.status === 'Solved'; }).length,
        attempted: d.problems.filter(function(p) { return p.status === 'Attempted'; }).length,
        total: d.problems.length
      };
      $scope.state.loading = false;
    }).catch(function(err) {
      $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load problems.') };
    });
  };
  $scope.load();

  function syncUrl() {
    const f = $scope.filters;
    $location.search({
      search: f.search || null,
      difficulty: f.difficulty !== 'All' ? f.difficulty : null,
      topic: f.topic !== 'All' ? f.topic : null,
      status: f.status !== 'All' ? f.status : null,
      recommended: f.recommendedOnly ? 'true' : null
    }).replace();
  }
  $scope.$watch('filters', syncUrl, true);

  $scope.setFilter = function(key, value) { $scope.filters[key] = value; };
  $scope.resetFilters = function() {
    $scope.filters = { search: '', difficulty: 'All', topic: 'All', status: 'All', recommendedOnly: false };
  };

  $scope.problemFilter = function(p) {
    const f = $scope.filters;
    const q = (f.search || '').toLowerCase().trim();
    if (q && p.title.toLowerCase().indexOf(q) === -1 && p.topic.toLowerCase().indexOf(q) === -1 &&
        (p.mistakeProneArea || '').toLowerCase().indexOf(q) === -1 && String(p.number) !== q.replace('#', '')) return false;
    if (f.difficulty !== 'All' && p.difficulty !== f.difficulty) return false;
    if (f.topic !== 'All' && p.topic !== f.topic) return false;
    if (f.status !== 'All' && p.status !== f.status) return false;
    if (f.recommendedOnly && !p.recommended) return false;
    return true;
  };

  $scope.goToSolve = function(id) { $location.path('/solve/' + id).search({}); };
}]);

// 3. Solve Problem Workspace
app.controller('SolveController', ['$scope', '$rootScope', '$routeParams', '$location', 'ApiService', 'ToastService', 'StorageService',
function($scope, $rootScope, $routeParams, $location, ApiService, ToastService, StorageService) {
  const problemId = $routeParams.problemId;
  if (!problemId) { $location.path('/problems'); return; }

  const userId = ($rootScope.currentUser && $rootScope.currentUser.id) || 'anon';
  const LANG_KEY = 'debugtrack.lang.' + userId;
  // One draft per user + problem + language (Java keeps the Review-1 key for compatibility)
  const draftKey = function(lang) {
    return 'debugtrack.draft.' + userId + '.' + problemId + (lang === 'java' ? '' : '.' + lang);
  };

  $scope.state = viewState();
  // Objects (not primitives) so ng-model / Monaco bindings work through the ng-if child scope
  $scope.editor = { code: '', language: 'java' };
  $scope.activeConsoleTab = 'testcases'; // testcases | output | result | history
  $scope.activeTestCaseIndex = 0;
  $scope.isRunningCode = false;
  $scope.isSubmitting = false;
  $scope.runOutput = null;
  $scope.runError = null;
  $scope.submissionResult = null;
  $scope.showResultModal = false;
  $scope.openHints = {};
  $scope.previousAttempts = [];
  $scope.isLoadingHistory = false;
  $scope.historyError = null;

  function starterFor(lang) {
    return ($scope.problem.starterCodes && $scope.problem.starterCodes[lang]) || '';
  }

  function loadLanguage(lang) {
    $scope.editor.language = lang;
    const draft = StorageService.get(draftKey(lang));
    $scope.editor.code = draft || starterFor(lang);
    $scope.restoredDraft = !!draft && draft !== starterFor(lang);
    $scope.runOutput = null;
    $scope.runError = null;
  }

  ApiService.getProblem(problemId).then(function(p) {
    $scope.problem = p;
    $scope.languages = p.languages || [{ id: 'java', label: 'Java' }];
    const valid = function(l) { return $scope.languages.some(function(x) { return x.id === l; }); };
    // Language priority: ?lang= link > last language used > default from Settings > Java
    const requested = $location.search().lang;
    const preferred = [requested, StorageService.get(LANG_KEY), $rootScope.editorSettings && $rootScope.editorSettings.defaultLanguage].find(valid);
    loadLanguage(preferred || 'java');
    if (requested) $location.search('lang', null).replace();
    $scope.state.loading = false;
    $scope.fetchProblemSubmissions();
  }).catch(function(err) {
    $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load this problem.'), notFound: err.status === 404 };
  });

  // Auto-save the editor contents per user + problem + language (survives page refresh)
  $scope.$watch('editor.code', function(code) {
    if ($scope.problem && typeof code === 'string') StorageService.set(draftKey($scope.editor.language), code);
  });

  $scope.onLanguageChange = function() {
    StorageService.set(LANG_KEY, $scope.editor.language);
    loadLanguage($scope.editor.language);
  };

  $scope.languageLabel = function(id) {
    const l = ($scope.languages || []).find(function(x) { return x.id === id; });
    return l ? l.label : id;
  };

  $scope.fetchProblemSubmissions = function() {
    $scope.isLoadingHistory = true;
    $scope.historyError = null;
    ApiService.getProblemSubmissions(problemId).then(function(list) {
      $scope.previousAttempts = list;
    }).catch(function(err) {
      $scope.historyError = ApiService.errorMessage(err, 'Could not load previous attempts.');
    }).finally(function() { $scope.isLoadingHistory = false; });
  };

  $scope.switchConsoleTab = function(tab) {
    $scope.activeConsoleTab = tab;
    if (tab === 'history') $scope.fetchProblemSubmissions();
  };

  $scope.loadAttemptCode = function(attempt) {
    if (attempt.language && attempt.language !== $scope.editor.language) {
      $scope.editor.language = attempt.language;
      StorageService.set(LANG_KEY, attempt.language);
    }
    $scope.editor.code = attempt.code;
    ToastService.info('Loaded your ' + attempt.status + ' attempt from ' + new Date(attempt.timestamp).toLocaleString() + ' into the editor.');
  };

  $scope.viewAttempt = function(attempt) {
    $scope.submissionResult = attempt;
    $scope.activeConsoleTab = 'result';
  };

  $scope.resetCode = function() {
    const starter = starterFor($scope.editor.language);
    if ($scope.editor.code !== starter && !window.confirm('Replace your code with the starter template?')) return;
    $scope.editor.code = starter;
    $scope.restoredDraft = false;
    ToastService.info('Code reset to the starter template.');
  };

  $scope.toggleHint = function(index) { $scope.openHints[index] = !$scope.openHints[index]; };
  $scope.selectTestCase = function(index) { $scope.activeTestCaseIndex = index; };

  function validateCode() {
    if (!($scope.editor.code || '').trim()) {
      ToastService.error('Your editor is empty. Write a solution first.');
      return false;
    }
    return true;
  }

  // Run Code: sample tests only, nothing is saved
  $scope.runCode = function() {
    if ($scope.isRunningCode || $scope.isSubmitting || !validateCode()) return;
    $scope.isRunningCode = true;
    $scope.activeConsoleTab = 'output';
    $scope.runOutput = null;
    $scope.runError = null;

    ApiService.runCode({ problemId: problemId, code: $scope.editor.code, language: $scope.editor.language }).then(function(data) {
      $scope.runOutput = data;
      if (data.passed) ToastService.success('All sample tests passed. Submit to run the hidden tests.');
    }).catch(function(err) {
      $scope.runError = ApiService.errorMessage(err, 'Code execution failed.');
    }).finally(function() { $scope.isRunningCode = false; });
  };

  // Submit: sample + hidden tests, mistake analysis, persisted
  $scope.submitCode = function() {
    if ($scope.isRunningCode || $scope.isSubmitting || !validateCode()) return;
    $scope.isSubmitting = true;

    ApiService.submitCode({ problemId: problemId, code: $scope.editor.code, language: $scope.editor.language }).then(function(data) {
      $scope.submissionResult = data;
      $scope.activeConsoleTab = 'result';
      $scope.showResultModal = data.passed || !$rootScope.editorSettings || $rootScope.editorSettings.showDiagnostics !== false;
      if (data.passed) $scope.problem.status = 'Solved';
      else if ($scope.problem.status === 'Not Started') $scope.problem.status = 'Attempted';
      $scope.fetchProblemSubmissions();
      $rootScope.$broadcast('data:changed');
    }).catch(function(err) {
      ToastService.error(ApiService.errorMessage(err, 'Submission failed.'));
    }).finally(function() { $scope.isSubmitting = false; });
  };

  $scope.closeResultModal = function() { $scope.showResultModal = false; };
  $scope.$on('modal:escape', $scope.closeResultModal);
  $scope.practiceTopic = function(topic) {
    $scope.showResultModal = false;
    $location.path('/problems').search(topic ? { topic: topic, status: 'Not Started' } : {});
  };
}]);

// 4. Mistake Patterns
app.controller('MistakesController', ['$scope', '$location', 'ApiService', 'ChartTheme',
function($scope, $location, ApiService, ChartTheme) {
  $scope.state = viewState();
  $scope.historyLimit = 10;

  ApiService.getMistakes().then(function(d) {
    $scope.d = d;
    $scope.maxCount = Math.max.apply(null, d.categories.map(function(c) { return c.count; }).concat([1]));
    const named = d.categories;
    $scope.distributionChartConfig = {
      type: 'doughnut',
      data: { labels: named.map(function(c) { return c.name; }), datasets: [{ data: named.map(function(c) { return c.count; }), backgroundColor: named.map(function(c) { return c.color; }), borderColor: '#121a2d', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: ChartTheme.legend(true, 'right'), tooltip: ChartTheme.tooltip } }
    };
    $scope.trendChartConfig = {
      type: 'bar',
      data: {
        labels: d.weekly.map(function(w) { return w.label; }),
        datasets: named.filter(function(c) { return c.count > 0; }).map(function(c) {
          return { type: 'bar', label: c.name, data: d.weekly.map(function(w) { return w.byCategory[c.name]; }), backgroundColor: c.color, stack: 'm', yAxisID: 'y' };
        }).concat([{
          type: 'line', label: 'Mistake rate (%)', data: d.weekly.map(function(w) { return w.mistakeRate; }), borderColor: '#e2e8f0', backgroundColor: '#e2e8f0', tension: 0.3, yAxisID: 'y1', spanGaps: true
        }])
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: ChartTheme.legend(true), tooltip: ChartTheme.tooltip },
        scales: angular.extend(ChartTheme.axes({ stacked: true }), {
          y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: '#94a3b8', callback: function(v) { return v + '%'; } } }
        })
      }
    };
    $scope.state.loading = false;
  }).catch(function(err) {
    $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load mistake patterns.') };
  });

  $scope.practiceTopic = function(topic) {
    $location.path('/problems').search(topic ? { topic: topic } : {});
  };
  $scope.openProblem = function(id) { $location.path('/solve/' + id); };
}]);

// 5. Performance Analytics
app.controller('AnalyticsController', ['$scope', 'ApiService', 'ChartTheme',
function($scope, ApiService, ChartTheme) {
  $scope.state = viewState();

  ApiService.getAnalytics().then(function(d) {
    $scope.d = d;
    const labels = d.weekly.map(function(w) { return w.label; });
    const topicsTried = d.topicStats.filter(function(t) { return t.submissions > 0; });
    const P = ChartTheme.palette;
    const base = function(extra) {
      return angular.merge({ responsive: true, maintainAspectRatio: false, plugins: { legend: ChartTheme.legend(false), tooltip: ChartTheme.tooltip } }, extra || {});
    };

    $scope.charts = {
      solved: {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Problems solved (cumulative)', data: d.weekly.map(function(w) { return w.solvedCumulative; }), borderColor: P.indigo, backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3 }] },
        options: base({ scales: ChartTheme.axes() })
      },
      accuracy: {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Accuracy (%)', data: d.weekly.map(function(w) { return w.accuracy; }), borderColor: P.emerald, backgroundColor: P.emerald, tension: 0.3, spanGaps: true }] },
        options: base({ scales: ChartTheme.axes({ hardMax: 100 }) })
      },
      mistakesOverTime: {
        type: 'bar',
        data: { labels: labels, datasets: [
          { label: 'Mistakes', data: d.weekly.map(function(w) { return w.mistakes; }), backgroundColor: 'rgba(244,63,94,0.8)', borderRadius: 6 },
          { label: 'Accepted', data: d.weekly.map(function(w) { return w.accepted; }), backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6 }
        ] },
        options: base({ plugins: { legend: ChartTheme.legend(true) }, scales: ChartTheme.axes() })
      },
      distribution: {
        type: 'doughnut',
        data: { labels: d.categories.map(function(c) { return c.name; }), datasets: [{ data: d.categories.map(function(c) { return c.count; }), backgroundColor: d.categories.map(function(c) { return c.color; }), borderColor: '#121a2d', borderWidth: 2 }] },
        options: base({ cutout: '62%', plugins: { legend: ChartTheme.legend(true, 'right') } })
      },
      topicAttempts: {
        type: 'bar',
        data: { labels: topicsTried.map(function(t) { return t.topic; }), datasets: [
          { label: 'Accepted', data: topicsTried.map(function(t) { return t.accepted; }), backgroundColor: 'rgba(16,185,129,0.85)', stack: 's' },
          { label: 'Not accepted', data: topicsTried.map(function(t) { return t.submissions - t.accepted; }), backgroundColor: 'rgba(244,63,94,0.75)', stack: 's' }
        ] },
        options: base({ indexAxis: 'y', plugins: { legend: ChartTheme.legend(true) }, scales: {
          x: { stacked: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8', precision: 0 } },
          y: { stacked: true, grid: { display: false }, ticks: { color: '#cbd5e1' } } } })
      },
      topicAccuracy: {
        type: 'bar',
        data: { labels: topicsTried.map(function(t) { return t.topic; }), datasets: [{ label: 'Accuracy (%)', data: topicsTried.map(function(t) { return t.accuracy; }),
          backgroundColor: topicsTried.map(function(t) { return t.accuracy >= 80 ? P.emerald : t.accuracy >= 50 ? P.amber : P.rose; }), borderRadius: 6 }] },
        options: base({ scales: ChartTheme.axes({ hardMax: 100 }) })
      }
    };
    $scope.state.loading = false;
  }).catch(function(err) {
    $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load analytics.') };
  });
}]);

// 6. Profile
app.controller('ProfileController', ['$scope', 'ApiService', 'AuthService', 'ToastService',
function($scope, ApiService, AuthService, ToastService) {
  $scope.state = viewState();
  $scope.showEditModal = false;

  $scope.load = function() {
    ApiService.getProfile().then(function(d) {
      $scope.d = d;
      const maxDay = Math.max.apply(null, d.last7Days.map(function(x) { return x.count; }).concat([1]));
      d.last7Days.forEach(function(x) { x.height = x.count ? Math.max(8, Math.round((x.count / maxDay) * 130)) : 4; });
      $scope.state.loading = false;
    }).catch(function(err) {
      $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load your profile.') };
    });
  };
  $scope.load();

  $scope.openEditModal = function() {
    $scope.editProfileData = { name: $scope.d.user.name, university: $scope.d.user.university };
    $scope.editErrors = {};
    $scope.showEditModal = true;
  };
  $scope.closeEditModal = function() { $scope.showEditModal = false; };
  $scope.$on('modal:escape', $scope.closeEditModal);

  $scope.saveProfile = function() {
    $scope.editErrors = {};
    const name = ($scope.editProfileData.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      $scope.editErrors.name = 'Name must be between 2 and 60 characters.';
      return;
    }
    $scope.savingProfile = true;
    ApiService.updateProfile({ name: name, university: ($scope.editProfileData.university || '').trim() }).then(function(res) {
      $scope.d.user = res.user;
      AuthService.updateCachedUser(res.user);
      $scope.showEditModal = false;
      ToastService.success('Profile updated.');
    }).catch(function(err) {
      $scope.editErrors = (err.data && err.data.fields) || {};
      ToastService.error(ApiService.errorMessage(err, 'Could not update profile.'));
    }).finally(function() { $scope.savingProfile = false; });
  };
}]);

// 7. Submission History
app.controller('SubmissionsController', ['$scope', '$rootScope', '$location', 'ApiService', 'StorageService',
function($scope, $rootScope, $location, ApiService, StorageService) {
  $scope.state = viewState();
  $scope.filters = { status: 'All', search: '' };
  $scope.statuses = ['All', 'Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded', 'Compilation Error'];
  $scope.selected = null;

  ApiService.getSubmissions().then(function(list) {
    $scope.submissions = list;
    $scope.state.loading = false;
  }).catch(function(err) {
    $scope.state = { loading: false, error: ApiService.errorMessage(err, 'Could not load submissions.') };
  });

  $scope.submissionFilter = function(s) {
    if ($scope.filters.status !== 'All' && s.status !== $scope.filters.status) return false;
    const q = ($scope.filters.search || '').toLowerCase().trim();
    if (q && s.problemTitle.toLowerCase().indexOf(q) === -1 && (s.mistakeCategory || '').toLowerCase().indexOf(q) === -1) return false;
    return true;
  };

  $scope.open = function(s) { $scope.selected = s; };
  $scope.close = function() { $scope.selected = null; };
  $scope.$on('modal:escape', $scope.close);
  $scope.openInEditor = function(s) {
    // Put the code in the problem's draft slot so the workspace opens with it
    const userId = ($rootScope.currentUser && $rootScope.currentUser.id) || 'anon';
    const lang = s.language || 'java';
    StorageService.set('debugtrack.draft.' + userId + '.' + s.problemId + (lang === 'java' ? '' : '.' + lang), s.code);
    $location.path('/solve/' + s.problemId).search({ lang: lang });
  };
}]);
