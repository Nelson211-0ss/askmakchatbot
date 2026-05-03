var Theme = {
  STORAGE_KEY: 'askmak-theme',

  _setDarkClass: function(dark) {
    document.documentElement.classList.toggle('dark', !!dark);
  },

  getSavedMode: function() {
    try {
      var v = localStorage.getItem(this.STORAGE_KEY);
      if (v === 'dark' || v === 'light' || v === 'system') return v;
      return null;
    } catch (e) {
      return null;
    }
  },

  /** Dark when explicitly dark, light when explicitly light; otherwise prefers-color-scheme (light fallback). */
  resolvedFromStorage: function() {
    var saved = this.getSavedMode();
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    } catch (e) {}
    return false;
  },

  isFollowingSystem: function() {
    var m = this.getSavedMode();
    return m !== 'dark' && m !== 'light';
  },

  init: function() {
    var self = this;
    self._setDarkClass(self.resolvedFromStorage());

    var mqListen = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var onSchemeChange = function(e) {
      if (!self.isFollowingSystem()) return;
      self._setDarkClass(!!e.matches);
    };

    if (mqListen && mqListen.addEventListener) {
      mqListen.addEventListener('change', onSchemeChange);
    } else if (mqListen && mqListen.addListener) {
      mqListen.addListener(onSchemeChange);
    }
  },

  toggle: function() {
    var nextDark = !document.documentElement.classList.contains('dark');
    this._setDarkClass(nextDark);
    try {
      localStorage.setItem(this.STORAGE_KEY, nextDark ? 'dark' : 'light');
    } catch (e) {}
  },

  get isDark() {
    return document.documentElement.classList.contains('dark');
  }
};

document.addEventListener('DOMContentLoaded', function() { Theme.init(); });
