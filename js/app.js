/**
 * DebugTrack - AngularJS Application Module, Services & Directives
 * Configures SPA routes (with an authentication guard), REST API services,
 * the Chart.js / Monaco directives and the resizable workspace dividers.
 */

const app = angular.module('debugTrackApp', ['ngRoute']);

// When the page is served by the Express backend (port 3000) use same-origin calls;
// otherwise (e.g. `python3 -m http.server 8080`) talk to the backend on localhost:3000.
app.constant('API_BASE', (function() {
  const loc = window.location;
  if (loc.protocol.startsWith('http') && loc.port === '3000') return '/api';
  return 'http://localhost:3000/api';
})());

// Routing Configuration (routes marked `public` are reachable without logging in)
app.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
  $routeProvider
    .when('/login', { templateUrl: 'pages/login.html', controller: 'AuthController', public: true })
    .when('/register', { templateUrl: 'pages/register.html', controller: 'AuthController', public: true })
    .when('/', { templateUrl: 'pages/dashboard.html', controller: 'DashboardController' })
    .when('/problems', { templateUrl: 'pages/problems.html', controller: 'ProblemsController', reloadOnSearch: false })
    .when('/solve/:problemId?', { templateUrl: 'pages/solve.html', controller: 'SolveController' })
    .when('/submissions', { templateUrl: 'pages/submissions.html', controller: 'SubmissionsController' })
    .when('/mistakes', { templateUrl: 'pages/mistakes.html', controller: 'MistakesController' })
    .when('/analytics', { templateUrl: 'pages/analytics.html', controller: 'AnalyticsController' })
    .when('/profile', { templateUrl: 'pages/profile.html', controller: 'ProfileController' })
    .otherwise({ redirectTo: '/' });

  $httpProvider.interceptors.push('AuthInterceptor');
}]);

// Route guard: private pages require a (non-expired) token; logged-in users skip login/register
app.run(['$rootScope', '$location', 'AuthService', function($rootScope, $location, AuthService) {
  $rootScope.$on('$routeChangeStart', function(event, next) {
    if (!next || !next.$$route) return;
    const isPublic = !!next.$$route.public;
    $rootScope.isAuthRoute = isPublic;
    if (!isPublic && !AuthService.isAuthenticated()) {
      event.preventDefault();
      AuthService.clear();
      $rootScope.isAuthRoute = true;
      $location.path('/login').search({});
    } else if (isPublic && AuthService.isAuthenticated()) {
      event.preventDefault();
      $rootScope.isAuthRoute = false;
      $location.path('/').search({});
    }
  });
}]);

// --------------------------------------------------------------------------
// Safe storage (localStorage can throw in private mode / blocked storage)
// --------------------------------------------------------------------------
app.factory('StorageService', ['$window', function($window) {
  const memory = {};
  return {
    get: function(key) {
      try { const v = $window.localStorage.getItem(key); if (v !== null) return v; } catch (e) { /* unavailable */ }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    set: function(key, value) {
      memory[key] = value;
      try { $window.localStorage.setItem(key, value); } catch (e) { /* unavailable */ }
    },
    remove: function(key) {
      delete memory[key];
      try { $window.localStorage.removeItem(key); } catch (e) { /* unavailable */ }
    }
  };
}]);

// --------------------------------------------------------------------------
// Authentication: JWT kept in localStorage, user profile cached on $rootScope
// --------------------------------------------------------------------------
app.factory('AuthService', ['$http', '$rootScope', 'API_BASE', 'StorageService', function($http, $rootScope, API_BASE, StorageService) {
  const TOKEN_KEY = 'debugtrack.token';
  const USER_KEY = 'debugtrack.user';

  function decodePayload(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part));
    } catch (e) {
      return null;
    }
  }

  function readUser() {
    try { return JSON.parse(StorageService.get(USER_KEY) || 'null'); } catch (e) { return null; }
  }

  function setSession(data) {
    StorageService.set(TOKEN_KEY, data.token);
    StorageService.set(USER_KEY, JSON.stringify(data.user));
    $rootScope.currentUser = data.user;
    $rootScope.$broadcast('auth:changed', data.user);
    return data.user;
  }

  const service = {
    getToken: function() { return StorageService.get(TOKEN_KEY); },
    getUser: function() { return readUser(); },
    isAuthenticated: function() {
      const token = service.getToken();
      if (!token) return false;
      const payload = decodePayload(token);
      return !!payload && (!payload.exp || payload.exp * 1000 > Date.now());
    },
    login: function(email, password) {
      return $http.post(API_BASE + '/auth/login', { email: email, password: password })
        .then(function(res) { return setSession(res.data); });
    },
    register: function(form) {
      return $http.post(API_BASE + '/auth/register', form)
        .then(function(res) { return setSession(res.data); });
    },
    refreshUser: function() {
      return $http.get(API_BASE + '/auth/me').then(function(res) {
        StorageService.set(USER_KEY, JSON.stringify(res.data.user));
        $rootScope.currentUser = res.data.user;
        return res.data.user;
      });
    },
    updateCachedUser: function(user) {
      StorageService.set(USER_KEY, JSON.stringify(user));
      $rootScope.currentUser = user;
    },
    clear: function() {
      StorageService.remove(TOKEN_KEY);
      StorageService.remove(USER_KEY);
      $rootScope.currentUser = null;
    }
  };

  $rootScope.currentUser = service.isAuthenticated() ? readUser() : null;
  return service;
}]);

// Attaches the JWT to API calls and handles expired/invalid sessions globally
app.factory('AuthInterceptor', ['$q', '$injector', '$rootScope', 'API_BASE', 'StorageService', function($q, $injector, $rootScope, API_BASE, StorageService) {
  let redirecting = false;
  return {
    request: function(config) {
      if (config.url && config.url.indexOf(API_BASE) === 0) {
        const token = StorageService.get('debugtrack.token');
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = 'Bearer ' + token;
        }
      }
      return config;
    },
    responseError: function(rejection) {
      const url = (rejection.config && rejection.config.url) || '';
      const isAuthCall = /\/auth\/(login|register)$/.test(url);
      if (rejection.status === 401 && !isAuthCall && !redirecting) {
        redirecting = true;
        const AuthService = $injector.get('AuthService');
        const ToastService = $injector.get('ToastService');
        const $location = $injector.get('$location');
        AuthService.clear();
        ToastService.error((rejection.data && rejection.data.error) || 'Your session has expired. Please log in again.');
        $location.path('/login').search({});
        setTimeout(function() { redirecting = false; }, 1000);
      }
      return $q.reject(rejection);
    }
  };
}]);

// --------------------------------------------------------------------------
// REST API wrapper used by all controllers
// --------------------------------------------------------------------------
app.factory('ApiService', ['$http', 'API_BASE', function($http, API_BASE) {
  const unwrap = function(res) { return res.data; };
  const api = {
    get: function(path, params) { return $http.get(API_BASE + path, { params: params }).then(unwrap); },
    post: function(path, body) { return $http.post(API_BASE + path, body).then(unwrap); },
    put: function(path, body) { return $http.put(API_BASE + path, body).then(unwrap); },

    /** Turns any $http rejection into a user-friendly sentence (never a stack trace). */
    errorMessage: function(err, fallback) {
      if (!err) return fallback || 'Something went wrong.';
      if (err.status === -1 || err.status === 0) return 'Cannot reach the DebugTrack server. Make sure the backend is running (cd backend && npm start).';
      if (err.data && typeof err.data.error === 'string') return err.data.error;
      if (err.status === 429) return 'Too many requests. Please wait a moment and try again.';
      if (err.status >= 500) return 'The server ran into a problem. Please try again.';
      return fallback || 'Something went wrong. Please try again.';
    },

    getDashboard: function() { return api.get('/dashboard'); },
    getProblems: function() { return api.get('/problems'); },
    getProblem: function(id) { return api.get('/problems/' + encodeURIComponent(id)); },
    getProblemSubmissions: function(id) { return api.get('/problems/' + encodeURIComponent(id) + '/submissions'); },
    getSubmissions: function(params) { return api.get('/submissions', params); },
    getSubmission: function(id) { return api.get('/submissions/' + id); },
    getAnalytics: function() { return api.get('/analytics'); },
    getMistakes: function() { return api.get('/mistakes'); },
    getRecommendations: function() { return api.get('/recommendations'); },
    getProfile: function() { return api.get('/profile'); },
    updateProfile: function(data) { return api.put('/profile', data); },
    changePassword: function(data) { return api.put('/profile/password', data); },
    getSettings: function() { return api.get('/settings'); },
    saveSettings: function(data) { return api.put('/settings', data); },
    runCode: function(body) { return api.post('/run', body); },
    submitCode: function(body) { return api.post('/submit', body); }
  };
  return api;
}]);

// Editor preferences shared by the Settings modal and the Monaco directive
app.factory('SettingsService', ['$rootScope', 'ApiService', function($rootScope, ApiService) {
  const defaults = { editorFontSize: 14, tabSize: 4, wordWrap: false, minimap: false, showDiagnostics: true, defaultLanguage: 'java' };
  $rootScope.editorSettings = angular.copy(defaults);
  return {
    load: function() {
      return ApiService.getSettings().then(function(data) {
        $rootScope.editorSettings = angular.extend(angular.copy(defaults), data.settings);
        return $rootScope.editorSettings;
      });
    },
    save: function(settings) {
      return ApiService.saveSettings(settings).then(function(data) {
        $rootScope.editorSettings = angular.extend(angular.copy(defaults), data.settings);
        return $rootScope.editorSettings;
      });
    },
    reset: function() { $rootScope.editorSettings = angular.copy(defaults); }
  };
}]);

// Toast Notification Service
app.factory('ToastService', ['$rootScope', '$timeout', function($rootScope, $timeout) {
  $rootScope.toasts = [];

  function showToast(message, type, icon) {
    const id = Date.now() + Math.random();
    // Avoid stacking identical messages
    if ($rootScope.toasts.some(function(t) { return t.message === message; })) return;
    $rootScope.toasts.push({ id: id, message: message, type: type, icon: icon });
    $timeout(function() {
      const index = $rootScope.toasts.findIndex(function(t) { return t.id === id; });
      if (index !== -1) $rootScope.toasts.splice(index, 1);
    }, type === 'error' ? 6000 : 4000);
  }

  return {
    success: function(msg) { showToast(msg, 'success', 'fa-solid fa-circle-check'); },
    error: function(msg) { showToast(msg, 'error', 'fa-solid fa-triangle-exclamation'); },
    info: function(msg) { showToast(msg, 'info', 'fa-solid fa-bolt'); }
  };
}]);

// Shared Chart.js styling for the dark theme
app.factory('ChartTheme', function() {
  const grid = 'rgba(255, 255, 255, 0.06)';
  const tick = '#94a3b8';
  const tooltip = { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', borderColor: '#334155', borderWidth: 1, padding: 10 };
  return {
    palette: { cyan: '#06b6d4', indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', purple: '#8b5cf6', slate: '#64748b' },
    tooltip: tooltip,
    axes: function(opts) {
      opts = opts || {};
      return {
        x: { grid: { display: !!opts.xGrid, color: grid }, ticks: { color: tick, font: { size: 11 } }, stacked: !!opts.stacked },
        y: {
          grid: { color: grid }, ticks: { color: tick, precision: 0 }, beginAtZero: true, stacked: !!opts.stacked,
          suggestedMax: opts.max, max: opts.hardMax
        }
      };
    },
    legend: function(show, position) {
      return { display: !!show, position: position || 'bottom', labels: { color: '#cbd5e1', font: { size: 11 }, boxWidth: 12, padding: 12 } };
    }
  };
});

// Relative time filter: "5 min ago", "3 days ago"
app.filter('timeAgo', function() {
  return function(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (isNaN(diff)) return '';
    if (diff < 60) return 'Just now';
    const m = Math.floor(diff / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hour' + (h > 1 ? 's' : '') + ' ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + ' day' + (d > 1 ? 's' : '') + ' ago';
    return new Date(iso).toLocaleDateString();
  };
});

// Escapes text, then renders `inline code` spans. Safe for ng-bind-html because all input is escaped first.
app.filter('richText', ['$sce', function($sce) {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return function(text) {
    if (text === null || text === undefined) return '';
    const escaped = String(text).replace(/[&<>"']/g, function(c) { return ESC[c]; });
    return $sce.trustAsHtml(escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>'));
  };
}]);

// Strips inline-code backticks for short plain-text previews
app.filter('plainText', function() {
  return function(text) { return String(text || '').replace(/`/g, ''); };
});

// Language id -> display name
app.filter('languageName', function() {
  const NAMES = { java: 'Java', python: 'Python', cpp: 'C++' };
  return function(id) { return NAMES[id] || id || 'Java'; };
});

// Verdict -> badge class
app.filter('verdictBadge', function() {
  return function(status) {
    if (status === 'Accepted') return 'badge-success';
    if (status === 'Compilation Error') return 'badge-warning';
    return 'badge-danger';
  };
});

app.filter('difficultyBadge', function() {
  return function(d) { return d === 'Easy' ? 'badge-easy' : d === 'Medium' ? 'badge-medium' : 'badge-hard'; };
});

app.filter('statusBadge', function() {
  return function(s) { return s === 'Solved' ? 'status-solved' : s === 'Attempted' ? 'status-in-progress' : 'status-not-started'; };
});

// Rule-engine analysis card (category, confidence, evidence, suggestion, practice topic)
app.directive('analysisCard', function() {
  return {
    restrict: 'A',
    scope: { a: '=analysisCard', onPractice: '&?' },
    templateUrl: 'pages/partials/analysis-card.html',
    link: function(scope) { scope.hasPractice = !!scope.onPractice; }
  };
});

// Per-test result list for runs and submissions
app.directive('testResultList', function() {
  return {
    restrict: 'A',
    scope: { tests: '=testResultList' },
    templateUrl: 'pages/partials/test-results.html'
  };
});

// Chart.js Reusable Directive
app.directive('dtChart', ['$timeout', function($timeout) {
  return {
    restrict: 'A',
    scope: {
      chartConfig: '=dtChart'
    },
    link: function(scope, element) {
      let chartInstance = null;

      function renderChart() {
        if (!scope.chartConfig || !window.Chart) return;
        if (chartInstance) {
          chartInstance.destroy();
        }

        const ctx = element[0].getContext('2d');
        chartInstance = new Chart(ctx, angular.copy(scope.chartConfig));
      }

      scope.$watch('chartConfig', function(newVal) {
        if (newVal) {
          $timeout(renderChart, 50);
        }
      }, true);

      scope.$on('$destroy', function() {
        if (chartInstance) {
          chartInstance.destroy();
        }
      });
    }
  };
}]);

// Monaco Editor Reusable Directive
app.directive('monacoEditor', ['$timeout', function($timeout) {
  return {
    restrict: 'A',
    scope: {
      code: '=',
      language: '=',
      options: '=?'
    },
    link: function(scope, element) {
      let editor = null;
      let internalChange = false;
      let destroyed = false;
      let resizeObserver = null;
      let layoutFrame = null;

      function editorOptions(o) {
        o = o || {};
        return {
          fontSize: o.editorFontSize || 14,
          tabSize: o.tabSize || 4,
          wordWrap: o.wordWrap ? 'on' : 'off',
          minimap: { enabled: !!o.minimap }
        };
      }

      function initMonaco() {
        if (destroyed) return;
        if (!window.require) {
          $timeout(initMonaco, 100);
          return;
        }

        window.require(['vs/editor/editor.main'], function() {
          // Route may have changed while Monaco was still loading
          if (destroyed) return;
          const domElement = element[0];
          domElement.innerHTML = '';

          editor = monaco.editor.create(domElement, angular.extend({
            value: scope.code || '',
            language: scope.language || 'java',
            theme: 'vs-dark',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            scrollBeyondLastLine: false,
            // Layout is driven by our own ResizeObserver below; fall back to Monaco's polling otherwise
            automaticLayout: !window.ResizeObserver,
            lineNumbers: 'on',
            roundedSelection: false,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 }
          }, editorOptions(scope.options)));

          // Re-layout whenever the container changes size (panel dividers, window resize, etc.)
          if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(function() {
              if (layoutFrame) return;
              layoutFrame = requestAnimationFrame(function() {
                layoutFrame = null;
                if (editor) editor.layout();
              });
            });
            resizeObserver.observe(domElement);
          }

          editor.onDidChangeModelContent(function() {
            if (!internalChange) {
              const val = editor.getValue();
              scope.$applyAsync(function() {
                scope.code = val;
              });
            }
          });

          // Watch for external code changes (e.g. reset or loading a previous attempt)
          scope.$watch('code', function(newVal) {
            if (editor && newVal !== editor.getValue()) {
              internalChange = true;
              editor.setValue(newVal || '');
              internalChange = false;
            }
          });

          // Watch for language changes
          scope.$watch('language', function(newLang) {
            if (editor && newLang && window.monaco) {
              monaco.editor.setModelLanguage(editor.getModel(), newLang);
            }
          });

          // Apply editor preferences from Settings
          scope.$watch('options', function(o) {
            if (editor && o) {
              const opts = editorOptions(o);
              editor.updateOptions({ fontSize: opts.fontSize, wordWrap: opts.wordWrap, minimap: opts.minimap });
              editor.getModel().updateOptions({ tabSize: opts.tabSize });
            }
          }, true);
        });
      }

      $timeout(initMonaco, 50);

      scope.$on('$destroy', function() {
        destroyed = true;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (layoutFrame) {
          cancelAnimationFrame(layoutFrame);
        }
        if (editor) {
          editor.dispose();
          editor = null;
        }
      });
    }
  };
}]);

// Resizable Split-Pane Divider Directive
// Placed on a gutter element between two sibling panes. Dragging stores the first
// pane's share of the parent container (in %) in a CSS custom property on the parent,
// so stylesheets/media queries stay in control of how that size is applied.
// Positions are remembered for the browser session (sessionStorage, in-memory fallback).
app.directive('paneResizer', ['$window', function($window) {
  const memoryStore = {};

  function loadSize(key) {
    try {
      const stored = $window.sessionStorage.getItem(key);
      if (stored !== null && !isNaN(parseFloat(stored))) return parseFloat(stored);
    } catch (e) { /* storage unavailable */ }
    return memoryStore[key];
  }

  function saveSize(key, value) {
    memoryStore[key] = value;
    try { $window.sessionStorage.setItem(key, String(value)); } catch (e) { /* storage unavailable */ }
  }

  function clearSize(key) {
    delete memoryStore[key];
    try { $window.sessionStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
  }

  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      const gutter = element[0];
      const container = gutter.parentElement;
      // "vertical" = a vertical divider between side-by-side columns
      const isVertical = attrs.paneResizer === 'vertical';
      const cssVar = attrs.resizerVar;
      const storageKey = 'debugtrack.layout.' + attrs.resizerKey;
      const defaultPct = parseFloat(attrs.resizerDefault) || 50;
      const minFirst = parseFloat(attrs.resizerMinFirst) || 0;   // px
      const minSecond = parseFloat(attrs.resizerMinSecond) || 0; // px
      const bodyClass = isVertical ? 'is-resizing-col' : 'is-resizing-row';
      const KEY_STEP_PCT = 2;

      let currentPct = defaultPct;
      let pendingPct = null;
      let frame = null;
      let dragging = false;
      let grabOffset = 0;

      function containerLength() {
        const rect = container.getBoundingClientRect();
        return isVertical ? rect.width : rect.height;
      }

      function clampPct(pct) {
        const total = containerLength();
        if (!total) return Math.min(Math.max(pct, 5), 95);
        const gutterLength = isVertical ? gutter.offsetWidth : gutter.offsetHeight;
        const minPct = (minFirst / total) * 100;
        const maxPct = ((total - minSecond - gutterLength) / total) * 100;
        if (maxPct <= minPct) return minPct;
        return Math.min(Math.max(pct, minPct), maxPct);
      }

      function apply(pct) {
        currentPct = pct;
        container.style.setProperty(cssVar, pct.toFixed(2) + '%');
        gutter.setAttribute('aria-valuenow', String(Math.round(pct)));
      }

      function onPointerDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        const rect = gutter.getBoundingClientRect();
        // Keep the gutter anchored to where it was grabbed, so it doesn't jump
        grabOffset = isVertical ? e.clientX - rect.left : e.clientY - rect.top;
        try { gutter.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
        gutter.classList.add('is-dragging');
        document.body.classList.add(bodyClass);
      }

      function onPointerMove(e) {
        if (!dragging) return;
        const rect = container.getBoundingClientRect();
        const total = isVertical ? rect.width : rect.height;
        if (!total) return;
        const firstLength = isVertical
          ? e.clientX - rect.left - grabOffset
          : e.clientY - rect.top - grabOffset;
        pendingPct = clampPct((firstLength / total) * 100);
        if (!frame) {
          frame = requestAnimationFrame(function() {
            frame = null;
            apply(pendingPct);
          });
        }
      }

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        if (frame) {
          cancelAnimationFrame(frame);
          frame = null;
          if (pendingPct !== null) apply(pendingPct);
        }
        pendingPct = null;
        try { gutter.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
        gutter.classList.remove('is-dragging');
        document.body.classList.remove(bodyClass);
        saveSize(storageKey, currentPct);
      }

      function onKeyDown(e) {
        const decrease = isVertical ? 'ArrowLeft' : 'ArrowUp';
        const increase = isVertical ? 'ArrowRight' : 'ArrowDown';
        if (e.key !== decrease && e.key !== increase) return;
        e.preventDefault();
        const delta = e.key === increase ? KEY_STEP_PCT : -KEY_STEP_PCT;
        apply(clampPct(currentPct + delta));
        saveSize(storageKey, currentPct);
      }

      function onDoubleClick() {
        clearSize(storageKey);
        apply(clampPct(defaultPct));
      }

      gutter.setAttribute('aria-valuemin', '0');
      gutter.setAttribute('aria-valuemax', '100');

      // Restore the previous divider position for this session
      const saved = loadSize(storageKey);
      apply(clampPct(saved !== undefined ? saved : defaultPct));

      gutter.addEventListener('pointerdown', onPointerDown);
      gutter.addEventListener('pointermove', onPointerMove);
      gutter.addEventListener('pointerup', endDrag);
      gutter.addEventListener('pointercancel', endDrag);
      gutter.addEventListener('lostpointercapture', endDrag);
      gutter.addEventListener('keydown', onKeyDown);
      gutter.addEventListener('dblclick', onDoubleClick);

      scope.$on('$destroy', function() {
        if (frame) cancelAnimationFrame(frame);
        document.body.classList.remove(bodyClass);
        gutter.removeEventListener('pointerdown', onPointerDown);
        gutter.removeEventListener('pointermove', onPointerMove);
        gutter.removeEventListener('pointerup', endDrag);
        gutter.removeEventListener('pointercancel', endDrag);
        gutter.removeEventListener('lostpointercapture', endDrag);
        gutter.removeEventListener('keydown', onKeyDown);
        gutter.removeEventListener('dblclick', onDoubleClick);
      });
    }
  };
}]);
