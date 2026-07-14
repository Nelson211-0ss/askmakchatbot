(function() {
    function loadConversations() {
      var main = document.getElementById('admin-main');
      AdminCore.adminFetch('/conversations?limit=50').then(function(d) {
        var rows = d.conversations || [];
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('conversations', AdminCore.PAGE_ICONS.conversations);
        html += '<div class="admin-page-card">';
        if (!rows.length) {
          html += '<p class="admin-page-empty">No conversations yet.</p>';
        } else {
          html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
          html +=
            '<th class="admin-page-th">Updated</th><th class="admin-page-th">Title</th><th class="admin-page-th">Who</th><th class="admin-page-th">Msgs</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';
          rows.forEach(function(c) {
            var who = c.user_id ? (c.full_name || c.email || 'User') : 'Guest';
            html += '<tr class="admin-page-tr">';
            html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(c.updated_at) + '</td>';
            html += '<td class="admin-page-td">' + Utils.escapeHtml(c.title || '') + '</td>';
            html += '<td class="admin-page-td">' + Utils.escapeHtml(who) + '</td>';
            html += '<td class="admin-page-td">' + (c.message_count || 0) + '</td>';
            html +=
              '<td class="admin-page-td"><button type="button" class="admin-page-link admin-open-chat" data-id="' +
              c.id +
              '">View</button></td></tr>';
          });
          html += '</tbody></table></div>';
        }
        html += '</div></div>';
        main.innerHTML = html;
        main.querySelectorAll('.admin-open-chat').forEach(function(btn) {
          btn.addEventListener('click', function() { AdminCore.openConversationModal(btn.getAttribute('data-id')); });
        });
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load conversations.'); });
    }

  AdminCore.sections['conversations'] = loadConversations;
})();
