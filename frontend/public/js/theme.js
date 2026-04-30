var Theme = {
  init: function() {
    var saved = localStorage.getItem('askmak-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }

    var self = this;
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('askmak-theme')) {
          document.documentElement.classList.toggle('dark', e.matches);
        }
      });
    }
  },

  toggle: function() {
    var isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('askmak-theme', isDark ? 'dark' : 'light');
  },

  get isDark() {
    return document.documentElement.classList.contains('dark');
  }
};

document.addEventListener('DOMContentLoaded', function() { Theme.init(); });
