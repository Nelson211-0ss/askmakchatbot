(function() {
    function loadReference() {
      var main = document.getElementById('admin-main');
      AdminCore.adminFetch('/reference-images').then(function(d) {
        var imgs = d.images || [];
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('reference', AdminCore.PAGE_ICONS.reference);
        html += '<div class="admin-page-card">';
        html += '<form id="ref-form" class="admin-ref-form">';
        html +=
          '<div class="admin-ref-field"><label for="ref-file-in">Image</label><input id="ref-file-in" type="file" name="image" accept="image/*" required class="block text-sm max-w-[14rem]"></div>';
        html +=
          '<div class="admin-ref-field"><label for="ref-cat-in">Category</label><input id="ref-cat-in" name="category" value="maps" class="w-28"></div>';
        html +=
          '<div class="admin-ref-field"><label for="ref-name-in">Name</label><input id="ref-name-in" name="name" placeholder="campus_map" class="w-36"></div>';
        html += '<button type="submit" class="admin-ref-submit">' + AdminCore.PAGE_ICONS.upload + 'Upload</button></form>';
        if (!imgs.length) {
          html += '<p class="admin-page-empty">No reference images yet.</p>';
        } else {
          html += '<div class="admin-ref-grid">';
          imgs.forEach(function(im) {
            html += '<article class="admin-ref-tile">';
            if (im.url) {
            html +=
              '<img src="' +
              Utils.escapeHtml(im.url) +
              '" alt="" onclick="Utils.openLightbox(this.src)">';
            }
            html += '<div class="admin-ref-tile__body">';
            html +=
              '<span class="admin-ref-tile__title" title="' +
              Utils.escapeHtml(im.key) +
              '">' +
              Utils.escapeHtml(im.display_name || im.key) +
              '</span>';
            html += '<div class="admin-ref-tile__actions">';
            html +=
              '<button type="button" class="admin-page-link admin-ref-edit" data-key="' +
              Utils.escapeHtml(im.key) +
              '">Edit meta</button>';
            html +=
              '<button type="button" class="admin-page-link admin-ref-del" style="color:#b91c1c" data-key="' +
              Utils.escapeHtml(im.key) +
              '">Delete</button></div></div></article>';
          });
          html += '</div>';
        }
        html += '</div></div>';
        main.innerHTML = html;
        var form = document.getElementById('ref-form');
        if (form) form.addEventListener('submit', function(ev) {
          ev.preventDefault();
          var fd = new FormData(form);
          fetch('/api/admin/reference-images', { method: 'POST', body: fd, credentials: 'include' }).then(function(res) {
            if (!res.ok) return res.json().then(function(j) { throw new Error(j.error); });
            return res.json();
          }).then(function() { Utils.showToast('Uploaded', 'success'); loadReference(); })
            .catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
        });
        main.querySelectorAll('.admin-ref-edit').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var key = btn.getAttribute('data-key');
            var im = imgs.filter(function(x) { return x.key === key; })[0] || {};
            var tagsStr = Array.isArray(im.tags) ? im.tags.join(', ') : (im.tags ? String(im.tags) : '');
            var mh = '<div class="admin-modal-body"><p class="admin-page-meta break-all">' + Utils.escapeHtml(key) + '</p>';
            mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-name">Display name</label>';
            mh += '<input id="ref-meta-name" class="admin-page-input" value="' + Utils.escapeHtml(im.display_name || '') + '"></div>';
            mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-cat">Category</label>';
            mh += '<input id="ref-meta-cat" class="admin-page-input" value="' + Utils.escapeHtml(im.category || '') + '"></div>';
            mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-desc">Description</label>';
            mh += '<textarea id="ref-meta-desc" rows="3" class="admin-page-textarea">' + Utils.escapeHtml(im.description || '') + '</textarea></div>';
            mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-tags">Tags (comma-separated)</label>';
            mh += '<input id="ref-meta-tags" class="admin-page-input" value="' + Utils.escapeHtml(tagsStr) + '"></div>';
            mh += '<div class="admin-modal-actions"><button type="button" id="ref-meta-save" class="admin-page-btn admin-page-btn--primary">Save metadata</button></div></div>';
            AdminCore.openModal('Reference image', mh);
            document.getElementById('ref-meta-save').addEventListener('click', function() {
              var rawTags = document.getElementById('ref-meta-tags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
              AdminCore.adminFetch('/reference-images/' + encodeURIComponent(key), {
                method: 'PUT',
                body: {
                  display_name: document.getElementById('ref-meta-name').value.trim() || null,
                  category: document.getElementById('ref-meta-cat').value.trim() || null,
                  description: document.getElementById('ref-meta-desc').value.trim() || null,
                  tags: rawTags
                }
              }).then(function() {
                Utils.showToast('Saved', 'success');
                AdminCore.closeModal();
                loadReference();
              }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
            });
          });
        });
        main.querySelectorAll('.admin-ref-del').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var key = btn.getAttribute('data-key');
            if (!confirm('Delete?')) return;
            AdminCore.adminFetch('/reference-images/' + encodeURIComponent(key), { method: 'DELETE' }).then(function() { loadReference(); });
          });
        });
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load reference images.'); });
    }

  AdminCore.sections['reference'] = loadReference;
})();
