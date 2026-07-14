(function() {
    var adminUsersPager = { page: 1, limit: 100, q: '' };

    function adminUsersBadgeRole(role) {
      var r = String(role || 'student').toLowerCase();
      if (r === 'admin') return AdminCore.adminPageBadge('Admin', 'success');
      return AdminCore.adminPageBadge('Student', 'neutral');
    }

    function adminUsersBadgeVerified(ok) {
      if (ok) {
        return (
          '<span class="admin-page-badge admin-page-badge--success">' +
          '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75 9 17.25 19.5 6.75"/></svg>Verified</span>'
        );
      }
      return AdminCore.adminPageBadge('Pending', 'warning');
    }

    function loadUsers() {
      var main = document.getElementById('admin-main');
      main.innerHTML = AdminCore.adminPageLoading();

      var qs =
        '?page=' +
        adminUsersPager.page +
        '&limit=' +
        adminUsersPager.limit +
        (adminUsersPager.q ? '&q=' + encodeURIComponent(adminUsersPager.q) : '');

      AdminCore.adminFetch('/users' + qs)
        .then(function(d) {
          var rows = d.users || [];
          var total = typeof d.total === 'number' ? d.total : 0;
          var page = d.page || 1;
          var limit = d.limit || adminUsersPager.limit;
          var sum = d.summary || {};
          var totalPages = Math.max(1, Math.ceil(total / limit));
          var fromIx = total ? (page - 1) * limit + 1 : 0;
          var toIx = Math.min(page * limit, total);

          var html = '<div class="admin-users">';

          html += '<div class="admin-page-hero-card">';
          html += '<div class="admin-page-hero-card__top">';
          html += '<div class="admin-page-hero-card__main">';
          html += '<span class="admin-page-section-icon admin-page-section-icon--hero shrink-0" aria-hidden="true">' + AdminCore.PAGE_ICONS.users + '</span>';
          html += '<div class="min-w-0">';
          html += '<p class="admin-kb-eyebrow">Directory</p>';
          html += '<h2 class="admin-page-section-title" style="font-size:1.25rem">Registered users</h2>';
          html +=
            '<p class="admin-page-section-sub">Everyone who signed up for AskMak. Search by name or email; open a row for chats and memories.</p>';
          html += '</div></div>';
          html += '<div class="admin-page-hero-stat" title="Total registered accounts">';
          html += '<span class="admin-page-hero-stat__value">' + String(sum.total_registered != null ? sum.total_registered : total) + '</span>';
          html += '<span class="admin-page-hero-stat__label">accounts</span></div></div>';

          html += '<div class="admin-page-stat-grid">';
          var statCards = [
            { label: 'Verified email', val: sum.verified },
            { label: 'Awaiting verify', val: sum.pending_verification },
            { label: 'Administrators', val: sum.admins },
            { label: 'This page', val: rows.length, accent: true }
          ];
          statCards.forEach(function(sc) {
            html +=
              '<div class="admin-page-stat' +
              (sc.accent ? ' admin-page-stat--accent' : '') +
              '"><p class="admin-page-stat__label">' +
              Utils.escapeHtml(sc.label) +
              '</p><p class="admin-page-stat__value">' +
              Utils.escapeHtml(String(sc.val != null ? sc.val : '—')) +
              '</p></div>';
          });
          html += '</div></div>';

          html += '<div class="admin-page-search-row">';
          html += '<label class="sr-only" for="admin-users-search">Search users</label>';
          html += '<div class="relative admin-page-search-field">';
          html +=
            '<span class="admin-page-search-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/></svg></span>';
          html +=
            '<input id="admin-users-search" type="search" autocomplete="off" placeholder="Search name or email…" value="' +
            Utils.escapeHtml(adminUsersPager.q) +
            '" class="admin-users-input"></div>';
          html += '<button type="button" id="admin-users-search-btn" class="admin-page-btn admin-page-btn--primary">Search</button>';
          html += '</div>';

          var tableBarMeta = '';
          if (adminUsersPager.q) {
            tableBarMeta =
              Utils.escapeHtml(String(total)) +
              ' match' +
              (total === 1 ? '' : 'es') +
              (total ? ' · rows ' + fromIx + '–' + toIx : '');
          } else {
            tableBarMeta = total ? 'Rows ' + fromIx + '–' + toIx + ' · ' + total + ' on file' : 'No accounts yet';
          }
          html += '<p class="admin-page-meta">' + tableBarMeta + '</p>';

          html += '<div class="admin-page-card">';
          html += '<div class="admin-page-table-scroll">';
          html += '<table class="admin-page-table"><thead class="admin-page-thead"><tr>';
          html +=
            '<th class="admin-page-th">Member</th><th class="admin-page-th">Email</th><th class="admin-page-th">Role</th><th class="admin-page-th">Status</th><th class="admin-page-th">Joined</th><th class="admin-page-th">Last active</th><th class="admin-page-th text-right">Chats</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';

          if (!rows.length) {
            html +=
              '<tr><td colspan="8"><p class="admin-page-empty">' +
              (adminUsersPager.q
                ? 'No users match <strong>' + Utils.escapeHtml(adminUsersPager.q) + '</strong>. Try another search.'
                : 'No registered users yet. New signups will appear here.') +
              '</p></td></tr>';
          } else {
            rows.forEach(function(u) {
              html += '<tr class="admin-page-tr admin-users-table-row">';
              html += '<td class="admin-page-td font-semibold">' + Utils.escapeHtml(u.full_name || '—') + '</td>';
              html +=
                '<td class="admin-page-td max-w-[14rem] truncate" title="' +
                Utils.escapeHtml(u.email || '') +
                '">' +
                Utils.escapeHtml(u.email || '') +
                '</td>';
              html += '<td class="admin-page-td">' + adminUsersBadgeRole(u.role) + '</td>';
              html += '<td class="admin-page-td">' + adminUsersBadgeVerified(u.email_verified) + '</td>';
              html += '<td class="admin-page-td whitespace-nowrap">' + Utils.escapeHtml(Utils.formatTime(u.created_at)) + '</td>';
              html +=
                '<td class="admin-page-td whitespace-nowrap">' +
                (u.last_active ? Utils.escapeHtml(Utils.formatTime(u.last_active)) : '—') +
                '</td>';
              html += '<td class="admin-page-td text-right tabular-nums font-semibold">' + String(u.chat_count != null ? u.chat_count : 0) + '</td>';
              html += '<td class="admin-page-td text-right whitespace-nowrap">';
              html +=
                '<button type="button" class="admin-page-btn admin-user-open" data-id="' +
                u.id +
                '">View</button> ';
              if (u.role !== 'admin') {
                html +=
                  '<button type="button" class="admin-page-btn admin-page-btn--danger admin-user-del" data-id="' +
                  u.id +
                  '">Delete</button>';
              }
              html += '</td></tr>';
            });
          }
          html += '</tbody></table></div></div>';

          if (total > limit || page > 1) {
            html += '<div class="admin-page-pagination">';
            html +=
              '<p class="admin-page-pagination__info">Page <strong>' +
              page +
              '</strong> of <strong>' +
              totalPages +
              '</strong></p>';
            html += '<div class="admin-page-pagination__actions">';
            html +=
              '<button type="button" id="admin-users-prev" class="admin-page-btn"' +
              (page <= 1 ? ' disabled' : '') +
              '>Previous</button>';
            html +=
              '<button type="button" id="admin-users-next" class="admin-page-btn"' +
              (page >= totalPages ? ' disabled' : '') +
              '>Next</button>';
            html += '</div></div>';
          }

          html += '</div>';
          main.innerHTML = html;

          var searchIn = document.getElementById('admin-users-search');
          function runSearch() {
            adminUsersPager.q = searchIn ? String(searchIn.value || '').trim() : '';
            adminUsersPager.page = 1;
            loadUsers();
          }
          var sb = document.getElementById('admin-users-search-btn');
          if (sb) sb.addEventListener('click', runSearch);
          if (searchIn) {
            searchIn.addEventListener('keydown', function(ev) {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                runSearch();
              }
            });
          }

          var prev = document.getElementById('admin-users-prev');
          if (prev)
            prev.addEventListener('click', function() {
              if (adminUsersPager.page > 1) {
                adminUsersPager.page--;
                loadUsers();
              }
            });
          var next = document.getElementById('admin-users-next');
          if (next)
            next.addEventListener('click', function() {
              adminUsersPager.page++;
              loadUsers();
            });

          main.querySelectorAll('.admin-user-open').forEach(function(btn) {
            btn.addEventListener('click', function() {
              AdminCore.adminFetch('/users/' + btn.getAttribute('data-id')).then(function(ud) {
                var u = ud.user;
                var chats = ud.chats || [];
                var memN = (ud.memories || []).length;
                var fb = ud.feedback || {};
                var mh = '<div class="space-y-4 text-mak-dark dark:text-gray-100">';
                mh +=
                  '<div><p class="text-lg font-semibold">' +
                  Utils.escapeHtml(u.full_name || '') +
                  '</p><p class="text-sm text-mak-green font-medium">' +
                  Utils.escapeHtml(u.email || '') +
                  '</p></div>';
                mh +=
                  '<div class="flex flex-wrap gap-2">' +
                  adminUsersBadgeRole(u.role) +
                  ' ' +
                  adminUsersBadgeVerified(u.email_verified) +
                  '</div>';
                mh +=
                  '<dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/80 dark:bg-gray-950/40">';
                mh +=
                  '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Joined</dt><dd class="font-medium">' +
                  Utils.escapeHtml(Utils.formatTime(u.created_at)) +
                  '</dd></div>';
                mh +=
                  '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Saved memories</dt><dd class="font-medium">' +
                  String(memN) +
                  '</dd></div>';
                mh +=
                  '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Chats (loaded)</dt><dd class="font-medium">' +
                  String(chats.length) +
                  ' recent</dd></div>';
                mh +=
                  '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Feedback</dt><dd class="font-medium">' +
                  (fb.up || 0) +
                  ' up · ' +
                  (fb.down || 0) +
                  ' down</dd></div></dl>';
                if (chats.length) {
                  mh += '<div><p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Recent chats</p><ul class="space-y-1.5 max-h-40 overflow-y-auto thin-scroll text-xs">';
                  chats.slice(0, 12).forEach(function(ch) {
                    mh +=
                      '<li class="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-1">' +
                      '<span class="truncate">' +
                      Utils.escapeHtml(ch.title || 'Chat') +
                      '</span>' +
                      '<span class="shrink-0 text-gray-400">' +
                      Utils.escapeHtml(Utils.formatTime(ch.updated_at)) +
                      '</span></li>';
                  });
                  mh += '</ul></div>';
                }
                mh += '</div>';
                AdminCore.openModal('User profile', mh);
              });
            });
          });
          main.querySelectorAll('.admin-user-del').forEach(function(btn) {
            btn.addEventListener('click', function() {
              if (!confirm('Delete this user? This removes their chats and linked data.')) return;
              AdminCore.adminFetch('/users/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
                Utils.showToast('Deleted', 'success');
                var tp = typeof total === 'number' ? total : 0;
                if (tp > 1 && rows.length === 1 && adminUsersPager.page > 1) adminUsersPager.page--;
                loadUsers();
              }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
            });
          });
        })
        .catch(function() {
          main.innerHTML = AdminCore.adminPageFail('Could not load users. Check network and permissions, then reopen this section.');
        });
    }

  AdminCore.sections['users'] = loadUsers;
})();
