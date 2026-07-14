(function() {
    var INACTIVITY_MS = 30 * 60 * 1000;

    var pollTimer = null;

    function setActiveNav(section) {
      document.querySelectorAll('.admin-nav').forEach(function(btn) {
        btn.removeAttribute('data-active');
        if (btn.getAttribute('data-section') === section) btn.setAttribute('data-active', 'true');
      });
      var copy = AdminCore.SECTION_COPY[section] || { title: section, subtitle: '' };
      document.getElementById('section-title').textContent = copy.title;
      var sub = document.getElementById('section-subtitle');
      if (sub) sub.textContent = copy.subtitle;
      var dateWrap = document.getElementById('admin-date-range-wrap');
      if (dateWrap) {
        if (section === 'overview') dateWrap.classList.remove('hidden');
        else dateWrap.classList.add('hidden');
      }
    }

    function closeMobileAdminSidebar() {
      if (
        typeof window.matchMedia === 'undefined' ||
        !window.matchMedia('(max-width: 1023px)').matches
      ) {
        return;
      }
      var sidebar = document.getElementById('admin-sidebar');
      var overlay = document.getElementById('sidebar-overlay');
      if (sidebar) {
        sidebar.classList.add('admin-sidebar-mobile-hidden');
        sidebar.setAttribute('aria-hidden', 'true');
      }
      if (overlay) overlay.classList.add('hidden');
    }

    function openMobileAdminSidebar() {
      if (
        typeof window.matchMedia !== 'undefined' &&
        !window.matchMedia('(max-width: 1023px)').matches
      ) {
        return;
      }
      var sidebar = document.getElementById('admin-sidebar');
      var overlay = document.getElementById('sidebar-overlay');
      if (sidebar) {
        sidebar.classList.remove('admin-sidebar-mobile-hidden');
        sidebar.setAttribute('aria-hidden', 'false');
      }
      if (overlay) overlay.classList.remove('hidden');
    }

    function loadSection(name) {
      closeMobileAdminSidebar();
      setActiveNav(name);
      AdminCore.destroyCharts();
      var mainEl = document.getElementById('admin-main');
      if (mainEl) {
        if (name === 'overview') mainEl.classList.add('admin-main--dashboard');
        else mainEl.classList.remove('admin-main--dashboard');
      }
      if (AdminCore.sections[name]) AdminCore.sections[name]();
    }

    function poll() {
      AdminCore.adminFetch('/stats').then(function(s) { AdminCore.escBadge(s.pending_escalations || 0); }).catch(function() {});
    }

    function init() {
      fetch('/api/auth/me', { credentials: 'include' }).then(function(r) {
        if (!r.ok) { window.location.href = '/login'; return; }
        return r.json();
      }).then(function(data) {
        if (
          !data ||
          !data.user ||
          String(data.user.role || '')
            .trim()
            .toLowerCase() !== 'admin'
        ) {
          window.location.href = '/';
          return;
        }
        var displayName = data.user.full_name || data.user.email || 'Admin';
        document.getElementById('admin-user-label').textContent = displayName;
        var av = document.getElementById('admin-user-avatar');
        if (av) av.textContent = (displayName.trim().charAt(0) || '?').toUpperCase();
        var asideEl = document.getElementById('admin-sidebar');
        if (
          asideEl &&
          typeof window.matchMedia !== 'undefined' &&
          window.matchMedia('(min-width: 1024px)').matches
        ) {
          asideEl.setAttribute('aria-hidden', 'false');
        }
        document.querySelectorAll('.admin-nav').forEach(function(btn) {
          btn.addEventListener('click', function() { loadSection(btn.getAttribute('data-section')); });
        });
        var loSide = document.getElementById('admin-logout-sidebar');
        if (loSide) {
          loSide.addEventListener('click', function() {
            fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(function() {
              window.location.href = '/';
            });
          });
        }
        document.getElementById('modal-close').addEventListener('click', AdminCore.closeModal);
        document.getElementById('admin-modal').addEventListener('click', function(e) { if (e.target.id === 'admin-modal') AdminCore.closeModal(); });
        document.getElementById('sidebar-open').addEventListener('click', openMobileAdminSidebar);
        document.getElementById('sidebar-close').addEventListener('click', closeMobileAdminSidebar);
        document.getElementById('sidebar-overlay').addEventListener('click', closeMobileAdminSidebar);
        var tt = document.getElementById('theme-toggle-admin');
        if (tt) tt.addEventListener('click', function() { Theme.toggle(); });
        ['mousemove', 'keydown', 'click'].forEach(function(ev) {
          document.addEventListener(ev, AdminCore.touch, true);
        });
        setInterval(function() {
          if (Date.now() - AdminCore.lastActivity > INACTIVITY_MS) {
            fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function() {
              window.location.href = '/login';
            });
          }
        }, 60000);
        pollTimer = setInterval(poll, 60000);
        loadSection('overview');
      }).catch(function() { window.location.href = '/login'; });
    }
  document.addEventListener('DOMContentLoaded', init);
})();
