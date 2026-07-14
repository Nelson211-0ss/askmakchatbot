(function() {
    function loadUnresolved() {
      var main = document.getElementById('admin-main');
      AdminCore.adminFetch('/unresolved?limit=100').then(function(d) {
        var items = d.items || [];
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('unresolved', AdminCore.PAGE_ICONS.unresolved);
        html += '<div class="admin-page-card"><p class="admin-page-hint">Assistant messages with low confidence or hedge phrases.</p>';
        if (!items.length) {
          html += '<p class="admin-page-empty">No unresolved items detected.</p>';
        } else {
          html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
          html +=
            '<th class="admin-page-th">When</th><th class="admin-page-th">User</th><th class="admin-page-th">Excerpt</th><th class="admin-page-th">Conf</th><th class="admin-page-th">Actions</th></tr></thead><tbody>';
          items.forEach(function(m) {
            var who = m.full_name || m.email || 'Guest';
            html += '<tr class="admin-page-tr">';
            html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(m.created_at) + '</td>';
            html += '<td class="admin-page-td">' + Utils.escapeHtml(who) + '</td>';
            html +=
              '<td class="admin-page-td max-w-md truncate">' + Utils.escapeHtml(Utils.truncate(m.content || '', 100)) + '</td>';
            html += '<td class="admin-page-td">' + (m.confidence_score != null ? m.confidence_score.toFixed(2) : '—') + '</td>';
            html += '<td class="admin-page-td space-x-2 whitespace-nowrap">';
            html +=
              '<button type="button" class="admin-page-link admin-open-chat" data-id="' + m.chat_id + '">Chat</button>';
            html +=
              '<button type="button" class="text-xs text-gray-600 dark:text-gray-400 admin-unres-dismiss" data-mid="' +
              m.id +
              '">Dismiss</button>';
            html +=
              '<button type="button" class="text-xs text-mak-red admin-unres-esc" data-mid="' +
              m.id +
              '">Escalate</button></td></tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div></div>';
        main.innerHTML = html;
        main.querySelectorAll('.admin-open-chat').forEach(function(btn) {
          btn.addEventListener('click', function() { AdminCore.openConversationModal(btn.getAttribute('data-id')); });
        });
        main.querySelectorAll('.admin-unres-dismiss').forEach(function(btn) {
          btn.addEventListener('click', function() {
            AdminCore.adminFetch('/unresolved/' + btn.getAttribute('data-mid'), { method: 'PATCH', body: { action: 'dismiss' } }).then(
              function() {
                Utils.showToast('Dismissed', 'success');
                loadUnresolved();
              }
            ).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
          });
        });
        main.querySelectorAll('.admin-unres-esc').forEach(function(btn) {
          btn.addEventListener('click', function() {
            AdminCore.adminFetch('/unresolved/' + btn.getAttribute('data-mid'), { method: 'PATCH', body: { action: 'escalate' } }).then(
              function() {
                Utils.showToast('Escalation created', 'success');
                loadUnresolved();
              }
            ).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
          });
        });
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load unresolved items.'); });
    }

  AdminCore.sections['unresolved'] = loadUnresolved;
})();
