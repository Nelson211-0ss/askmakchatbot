var Utils = {
  renderMarkdown: function(text) {
    if (!text) return '';
    var html = marked.parse(text);
    var clean = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target'],
      ALLOWED_TAGS: ['p','br','strong','em','b','i','a','code','pre','ul','ol','li',
        'h1','h2','h3','h4','h5','blockquote','table','thead','tbody','tr','th','td',
        'img','hr','del','sup','sub','span','div']
    });
    return clean.replace(/<a\s/g, '<a target="_blank" rel="noopener" ');
  },

  formatTime: function(dateStr) {
    var date = new Date(dateStr);
    var now = new Date();
    var diff = now - date;
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatDate: function(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  groupByDate: function(items) {
    var groups = { today: [], yesterday: [], week: [], older: [] };
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    var weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    items.forEach(function(item) {
      var date = new Date(item.updated_at || item.created_at);
      if (date >= today) groups.today.push(item);
      else if (date >= yesterday) groups.yesterday.push(item);
      else if (date >= weekAgo) groups.week.push(item);
      else groups.older.push(item);
    });

    return groups;
  },

  debounce: function(fn, delay) {
    var timer;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  },

  truncate: function(text, len) {
    if (!text || text.length <= len) return text;
    return text.substring(0, len) + '...';
  },

  escapeHtml: function(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  getInitials: function(name) {
    if (!name) return '?';
    return name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
  },

  showToast: function(message, type) {
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    var colors = type === 'success' ? 'bg-mak-green text-white'
      : type === 'error' ? 'bg-mak-red text-white'
      : 'bg-mak-dark text-white';

    var toast = document.createElement('div');
    toast.className = 'px-5 py-3 rounded-lg text-sm shadow-lg animate-toast-in min-w-[260px] pointer-events-auto font-sans ' + colors;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s ease';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
  },

  showConfirm: function(title, message) {
    return new Promise(function(resolve) {
      var overlay = document.getElementById('confirm-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-overlay';
        overlay.className = 'hidden fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-5';
        overlay.innerHTML =
          '<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-xl animate-modal-in">' +
            '<h4 class="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100"></h4>' +
            '<p class="text-gray-500 dark:text-gray-400 text-sm mb-5 leading-relaxed"></p>' +
            '<div class="flex gap-2 justify-end">' +
              '<button class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer confirm-cancel">Cancel</button>' +
              '<button class="px-4 py-2 rounded-lg text-sm font-medium bg-mak-red text-white hover:opacity-90 transition cursor-pointer confirm-ok">Confirm</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
      }

      overlay.querySelector('h4').textContent = title;
      overlay.querySelector('p').textContent = message;
      overlay.classList.remove('hidden');

      function cleanup(result) {
        overlay.classList.add('hidden');
        resolve(result);
      }

      overlay.querySelector('.confirm-cancel').onclick = function() { cleanup(false); };
      overlay.querySelector('.confirm-ok').onclick = function() { cleanup(true); };
    });
  },

  openLightbox: function(src) {
    var lb = document.getElementById('lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'lightbox';
      lb.className = 'hidden fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-10 cursor-pointer';
      lb.innerHTML =
        '<img src="" alt="Full size" class="max-w-full max-h-full object-contain rounded-lg">' +
        '<button class="absolute top-5 right-5 bg-white/15 hover:bg-white/25 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl border-none cursor-pointer transition">&times;</button>';
      lb.addEventListener('click', function() { lb.classList.add('hidden'); });
      document.body.appendChild(lb);
    }
    lb.querySelector('img').src = src;
    lb.classList.remove('hidden');
  }
};

if (typeof marked !== 'undefined') {
  marked.setOptions({ breaks: true, gfm: true });
}
