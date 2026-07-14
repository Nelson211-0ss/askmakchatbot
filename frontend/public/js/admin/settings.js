(function() {
    function loadSettings() {
      var main = document.getElementById('admin-main');
      AdminCore.adminFetch('/settings').then(function(d) {
        var s = d.settings || {};
        function pickStr(v) { return v == null ? '' : String(v); }
        function pickNum(v, def) {
          if (v == null || v === '') return def;
          if (typeof v === 'number' && !isNaN(v)) return Math.round(v);
          var n = parseInt(String(v), 10);
          return isNaN(n) ? def : n;
        }
        function pickFloat(v, def) {
          if (v == null || v === '') return def;
          if (typeof v === 'number' && !isNaN(v)) return v;
          var f = parseFloat(String(v));
          return isNaN(f) ? def : f;
        }
        function pickBool(v, def) {
          if (v === true || v === 'true') return true;
          if (v === false || v === 'false') return false;
          return def;
        }

        var prompt = pickStr(s.system_prompt);
        var guestRate = pickNum(s.guest_rate_limit, 20);
        var authRate = pickNum(s.auth_rate_limit, 100);
        var confidence = pickFloat(s.confidence_escalation_threshold, 0.65);
        var maxTool = pickNum(s.max_tool_depth, 3);
        var guestRetention = pickNum(s.guest_chat_retention_days, 30);
        var guestEnabled = pickBool(s.guest_mode_enabled, true);
        var domains = pickStr(s.allowed_fetch_domains) || '*.mak.ac.ug';

        var schemaMissing = !!(d.note && String(d.note).indexOf('admin_schema') >= 0);

        var html = '<div class="admin-page-wrap admin-settings">';
        html += '<div class="admin-settings-hero"><div>';
        html += '<h2>Platform settings</h2>';
        html += '<p>Configure prompts, safeguards, guest access, and tool limits stored in your database.</p>';
        if (schemaMissing) {
          html += '<p class="admin-settings-warning">' + Utils.escapeHtml(d.note || '') + '</p>';
        }
        html += '</div><span class="admin-settings-badge">Admin</span></div>';

        html += '<div class="admin-settings-grid">';
        html += '<section class="admin-settings-card admin-settings-card--full">';
        html += '<h3>Assistant persona</h3>';
        html += '<div class="admin-settings-field"><label for="set-prompt">System prompt</label>';
        html +=
          '<textarea id="set-prompt" class="admin-settings-textarea admin-settings-textarea--prompt" rows="6">' +
          Utils.escapeHtml(prompt) +
          '</textarea>';
        html += '<p class="admin-settings-hint">Base instructions injected for every AskMak reply. Tone, scope (Makerere-only), escalation rules, etc.</p></div></section>';

        html += '<section class="admin-settings-card">';
        html += '<h3>Message rate limits</h3>';
        html += '<div class="admin-settings-row admin-settings-row--2">';
        html += '<div class="admin-settings-field"><label for="set-guest">Guest messages per hour</label>';
        html += '<input id="set-guest" type="number" min="1" max="9999" class="admin-settings-input" value="' + guestRate + '">';
        html += '<p class="admin-settings-hint">Per guest token / session cap before slowdown.</p></div>';
        html += '<div class="admin-settings-field"><label for="set-auth">Signed-in messages per hour</label>';
        html += '<input id="set-auth" type="number" min="1" max="9999" class="admin-settings-input" value="' + authRate + '">';
        html += '<p class="admin-settings-hint">Per authenticated user.</p></div></div></section>';

        html += '<section class="admin-settings-card">';
        html += '<h3>Quality & tooling</h3>';
        html += '<div class="admin-settings-field"><label for="set-confidence">Escalation confidence threshold</label>';
        html += '<input id="set-confidence" type="number" min="0" max="1" step="0.01" class="admin-settings-input" value="' + confidence + '">';
        html += '<p class="admin-settings-hint">0–1. Below this retrieval confidence suggests staff review / escalation workflows.</p></div>';
        html += '<div class="admin-settings-field"><label for="set-max-tool">Max tool recursion depth</label>';
        html += '<input id="set-max-tool" type="number" min="1" max="12" class="admin-settings-input" value="' + maxTool + '">';
        html += '<p class="admin-settings-hint">How deeply chained tool calls may run.</p></div></section>';

        html += '<section class="admin-settings-card">';
        html += '<h3>Guest experience</h3>';
        html += '<label class="admin-settings-check" for="set-guest-enabled">';
        html += '<input type="checkbox" id="set-guest-enabled"' + (guestEnabled ? ' checked' : '') + '>';
        html += '<span><strong>Guest mode</strong> Allow chats without signing in (subject to retention and hourly caps).</span></label>';
        html += '<div class="admin-settings-field admin-settings-field--spaced"><label for="set-guest-retention">Guest chat retention (days)</label>';
        html += '<input id="set-guest-retention" type="number" min="1" max="730" class="admin-settings-input" value="' + guestRetention + '">';
        html += '<p class="admin-settings-hint">How long anonymised guest threads are retained for support.</p></div></section>';

        html += '<section class="admin-settings-card">';
        html += '<h3>Fetching & URLs</h3>';
        html += '<div class="admin-settings-field"><label for="set-domains">Allowed fetch domain pattern</label>';
        html += '<input id="set-domains" type="text" autocomplete="off" class="admin-settings-input" value="' + Utils.escapeHtml(domains) + '" placeholder="*.mak.ac.ug">';
        html += '<p class="admin-settings-hint">Wildcard pattern restricting outbound page fetches.</p></div></section>';

        html += '<section class="admin-settings-card admin-settings-card--full admin-settings-card--muted">';
        html += '<h3>Environment (read-only)</h3>';
        html += '<p class="admin-settings-note">API keys and network endpoints are configured in <code>.env</code>; chat models listed here mirror the running server.</p>';
        html += '<dl class="admin-settings-env">';
        html += '<dt>Chat model</dt><dd>' + Utils.escapeHtml(d.openai_model || '—') + '</dd>';
        html += '<dt>Embedding model</dt><dd>' + Utils.escapeHtml(d.embedding_model || '—') + '</dd>';
        html += '</dl></section></div>';

        html += '<div class="admin-settings-actions">';
        html += '<button type="button" id="set-save" class="admin-settings-save">Save all settings</button>';
        html += '<span class="admin-settings-save-hint">Updates apply on the next request.</span></div></div>';

        main.innerHTML = html;

        document.getElementById('set-save').addEventListener('click', function() {
          var gr = parseInt(document.getElementById('set-guest').value, 10);
          var ar = parseInt(document.getElementById('set-auth').value, 10);
          var conf = parseFloat(document.getElementById('set-confidence').value);
          var mtd = parseInt(document.getElementById('set-max-tool').value, 10);
          var gret = parseInt(document.getElementById('set-guest-retention').value, 10);
          if (isNaN(gr) || gr < 1) { Utils.showToast('Guest rate must be ≥ 1', 'error'); return; }
          if (isNaN(ar) || ar < 1) { Utils.showToast('Auth rate must be ≥ 1', 'error'); return; }
          if (isNaN(conf) || conf < 0 || conf > 1) { Utils.showToast('Confidence must be between 0 and 1', 'error'); return; }
          if (isNaN(mtd) || mtd < 1) { Utils.showToast('Tool depth must be ≥ 1', 'error'); return; }
          if (isNaN(gret) || gret < 1) { Utils.showToast('Retention must be ≥ 1 day', 'error'); return; }
          var domVal = document.getElementById('set-domains').value.trim();
          if (!domVal) { Utils.showToast('Domain pattern required', 'error'); return; }
          var payload = {
            system_prompt: document.getElementById('set-prompt').value,
            guest_rate_limit: gr,
            auth_rate_limit: ar,
            confidence_escalation_threshold: conf,
            max_tool_depth: mtd,
            guest_chat_retention_days: gret,
            guest_mode_enabled: document.getElementById('set-guest-enabled').checked,
            allowed_fetch_domains: domVal
          };
          AdminCore.adminFetch('/settings', { method: 'PUT', body: payload }).then(function() {
            Utils.showToast('Saved', 'success');
            loadSettings();
          }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
        });
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load settings.'); });
    }

  AdminCore.sections['settings'] = loadSettings;
})();
