var Chat = {
  chatId: null,
  isStreaming: false,
  controller: null,
  inChatMode: false,

  init: function() {
    var self = this;

    Auth.init().then(function() {
      Sidebar.init();
      self.renderWelcome();
      Upload.init();
    });

    var input = document.getElementById('message-input');
    var sendBtn = document.getElementById('send-btn');

    input.addEventListener('input', function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 128) + 'px';
      sendBtn.disabled = !input.value.trim() && !Upload.file;
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.sendMessage();
      }
    });

    sendBtn.addEventListener('click', function() { self.sendMessage(); });

    document.getElementById('theme-toggle').addEventListener('click', function() { Theme.toggle(); });
    document.getElementById('modal-theme-toggle').addEventListener('click', function() { Theme.toggle(); });

    document.getElementById('user-menu-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('user-menu-dropdown').classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#user-menu-btn') && !e.target.closest('#user-menu-dropdown')) {
        document.getElementById('user-menu-dropdown').classList.add('hidden');
      }
    });

    document.getElementById('settings-btn').addEventListener('click', function() {
      document.getElementById('user-menu-dropdown').classList.add('hidden');
      document.getElementById('settings-modal').classList.remove('hidden');
    });

    document.getElementById('memories-btn').addEventListener('click', function() {
      document.getElementById('user-menu-dropdown').classList.add('hidden');
      document.getElementById('memories-modal').classList.remove('hidden');
      self.loadMemories();
    });

    document.getElementById('logout-btn').addEventListener('click', function() {
      document.getElementById('user-menu-dropdown').classList.add('hidden');
      Auth.logout();
    });

    document.querySelectorAll('.modal-close').forEach(function(btn) {
      btn.addEventListener('click', function() {
        btn.closest('[id$="-modal"]').classList.add('hidden');
      });
    });

    document.querySelectorAll('[id$="-modal"]').forEach(function(modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    var msgs = document.getElementById('chat-messages');
    var scrollBtn = document.getElementById('scroll-bottom');
    msgs.addEventListener('scroll', function() {
      var atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 100;
      if (atBottom) {
        scrollBtn.classList.add('hidden');
        scrollBtn.classList.remove('flex');
      } else {
        scrollBtn.classList.remove('hidden');
        scrollBtn.classList.add('flex');
      }
    });
    scrollBtn.addEventListener('click', function() {
      msgs.scrollTo({ top: msgs.scrollHeight, behavior: 'smooth' });
    });

    document.querySelectorAll('.quick-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.getElementById('message-input').value = btn.textContent;
        document.getElementById('send-btn').disabled = false;
        self.sendMessage();
      });
    });

    window.addEventListener('online', function() {
      document.getElementById('offline-banner').classList.add('hidden');
    });
    window.addEventListener('offline', function() {
      document.getElementById('offline-banner').classList.remove('hidden');
    });
  },

  switchToChat: function() {
    if (this.inChatMode) return;
    this.inChatMode = true;
    var body = document.getElementById('chat-body');
    body.classList.remove('justify-center');
    document.getElementById('welcome-screen').classList.add('hidden');
    var actions = document.getElementById('welcome-actions');
    if (actions) actions.classList.add('hidden');
    var msgs = document.getElementById('chat-messages');
    msgs.classList.remove('hidden');
    msgs.classList.add('flex', 'flex-col', 'flex-1');
  },

  switchToWelcome: function() {
    this.inChatMode = false;
    var body = document.getElementById('chat-body');
    body.classList.add('justify-center');
    document.getElementById('welcome-screen').classList.remove('hidden');
    var actions = document.getElementById('welcome-actions');
    if (actions) actions.classList.remove('hidden');
    var msgs = document.getElementById('chat-messages');
    msgs.innerHTML = '';
    msgs.classList.add('hidden');
    msgs.classList.remove('flex', 'flex-col', 'flex-1');
  },

  renderWelcome: function() {
    var name = Auth.user ? Auth.user.full_name.split(' ')[0] : 'there';
    document.getElementById('welcome-greeting').textContent = 'Hi ' + name + ', how can I help you today?';
    this.switchToWelcome();
  },

  newChat: function() {
    this.chatId = null;
    this.isStreaming = false;
    if (this.controller) { this.controller.abort(); this.controller = null; }
    Sidebar.activeId = null;
    Sidebar.render();
    this.renderWelcome();
  },

  loadChat: async function(id) {
    try {
      this.switchToChat();
      var result = await API.get('/chats/' + id + '/messages');
      this.chatId = id;
      var msgs = document.getElementById('chat-messages');
      msgs.innerHTML = '';

      var messages = result.messages || result || [];
      var self = this;
      messages.forEach(function(msg) {
        self.appendMessage(msg, false);
      });

      msgs.scrollTop = msgs.scrollHeight;
    } catch (e) {
      Utils.showToast('Failed to load chat', 'error');
    }
  },

  sendMessage: async function() {
    if (this.isStreaming) return;

    var input = document.getElementById('message-input');
    var text = input.value.trim();
    if (!text && !Upload.file) return;

    this.switchToChat();

    var imageKey = null;
    if (Upload.file) {
      imageKey = await Upload.upload(this.chatId || 'temp');
    }

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;

    var userMsg = {
      role: 'user',
      content: text,
      image_key: imageKey,
      created_at: new Date().toISOString()
    };
    this.appendMessage(userMsg);

    this.isStreaming = true;
    this.showTyping(true);

    try {
      if (!this.chatId) {
        var chatResult = await API.post('/chats', { title: text.substring(0, 50) });
        this.chatId = chatResult.id;
        Sidebar.addChat(chatResult);
      }

      this.controller = new AbortController();
      var self = this;
      var botContent = '';
      var botDiv = null;

      await API.stream('/chats/' + this.chatId + '/messages', {
        content: text,
        image_key: imageKey
      }, function(data) {
        if (data.type === 'token' || data.type === 'delta') {
          botContent += data.content || data.delta || '';
          if (!botDiv) {
            self.showTyping(false);
            botDiv = self.appendMessage({ role: 'assistant', content: botContent, created_at: new Date().toISOString() });
          } else {
            var bubble = botDiv.querySelector('.msg-content');
            if (bubble) bubble.innerHTML = Utils.renderMarkdown(botContent);
          }
          var msgs = document.getElementById('chat-messages');
          msgs.scrollTop = msgs.scrollHeight;
        }

        if (data.type === 'sources' && data.sources) {
          var srcHtml = self.renderSources(data.sources);
          if (botDiv) {
            var wrapper = botDiv.querySelector('.msg-meta');
            if (wrapper) wrapper.insertAdjacentHTML('afterbegin', srcHtml);
          }
        }

        if (data.type === 'done') {
          if (botDiv) {
            var actionsHtml = self.renderActions(data.message_id);
            var wrapper = botDiv.querySelector('.msg-meta');
            if (wrapper) wrapper.insertAdjacentHTML('beforeend', actionsHtml);
            self.bindActions(botDiv);
          }
        }

        if (data.type === 'error') {
          self.showTyping(false);
          Utils.showToast(data.message || 'Something went wrong', 'error');
        }
      }, this.controller.signal);

    } catch (e) {
      if (e.name !== 'AbortError') {
        Utils.showToast('Failed to send message. Please try again.', 'error');
      }
    } finally {
      this.isStreaming = false;
      this.showTyping(false);
      this.controller = null;
    }
  },

  appendMessage: function(msg, scroll) {
    var msgs = document.getElementById('chat-messages');
    var div = document.createElement('div');
    var isUser = msg.role === 'user';

    div.className = 'flex gap-3 max-w-3xl w-full mx-auto py-3 animate-fade-in' + (isUser ? ' flex-row-reverse' : '');
    if (msg.id) div.dataset.msgId = msg.id;

    var avatarBg = isUser ? 'bg-mak-green text-white dark:bg-mak-green dark:text-white' : 'bg-mak-dark text-white';
    var avatarText = isUser ? Utils.getInitials(Auth.user ? Auth.user.full_name : 'G') : 'M';

    var html = '<div class="w-8 h-8 rounded-full ' + avatarBg + ' flex items-center justify-center text-xs font-semibold shrink-0">' + avatarText + '</div>';
    html += '<div class="flex-1 min-w-0' + (isUser ? ' flex flex-col items-end' : '') + '">';

    if (isUser) {
      html += '<div class="bg-mak-green text-white dark:bg-mak-green/35 dark:text-white dark:border dark:border-mak-green/40 px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed max-w-[85%] break-words">';
      html += Utils.escapeHtml(msg.content || '');
      html += '</div>';
    } else {
      html += '<div class="msg-content bg-transparent dark:bg-transparent px-0 py-1 text-sm leading-relaxed break-words prose prose-sm prose-sans dark:prose-invert prose-a:text-mak-green dark:prose-a:text-mak-green prose-headings:font-semibold dark:prose-headings:text-zinc-50 dark:prose-strong:text-white dark:prose-code:text-mak-green/95 dark:prose-pre:bg-chat-sidebar/80 dark:prose-pre:text-zinc-200 max-w-none">';
      html += Utils.renderMarkdown(msg.content || '');
      html += '</div>';
    }

    if (msg.image_key) {
      html += '<img src="/api/images/' + msg.image_key + '" alt="Attached image" class="mt-2 max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition" onclick="Utils.openLightbox(this.src)">';
    }

    html += '<div class="msg-meta flex flex-wrap items-center gap-2 mt-1.5">';
    html += '<span class="text-[11px] text-zinc-500 dark:text-mak-green/50">' + Utils.formatTime(msg.created_at) + '</span>';
    html += '</div>';

    html += '</div>';
    div.innerHTML = html;
    msgs.appendChild(div);

    if (scroll !== false) {
      msgs.scrollTop = msgs.scrollHeight;
    }

    return div;
  },

  renderSources: function(sources) {
    if (!sources || !sources.length) return '';
    var html = '<div class="flex flex-wrap gap-1.5">';
    sources.forEach(function(s) {
      html += '<a href="' + Utils.escapeHtml(s.url || '#') + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100/80 dark:bg-mak-green/[0.08] rounded-full text-[11px] text-zinc-600 dark:text-zinc-300 no-underline hover:bg-zinc-200/90 dark:hover:bg-mak-green/15 transition">';
      html += '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
      html += Utils.escapeHtml(Utils.truncate(s.title || s.url, 30));
      html += '</a>';
    });
    html += '</div>';
    return html;
  },

  renderActions: function(messageId) {
    var html = '<div class="flex gap-0.5 items-center">';
    html += '<button class="feedback-btn bg-transparent border border-transparent rounded p-1 px-1.5 cursor-pointer text-zinc-400 dark:text-zinc-500 flex items-center gap-1 text-xs hover:bg-zinc-100 dark:hover:bg-mak-green/10 hover:border-zinc-200 dark:hover:border-mak-green/30 transition" data-type="positive" data-msg="' + (messageId || '') + '" title="Helpful">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
    html += '</button>';
    html += '<button class="feedback-btn bg-transparent border border-transparent rounded p-1 px-1.5 cursor-pointer text-zinc-400 dark:text-zinc-500 flex items-center gap-1 text-xs hover:bg-zinc-100 dark:hover:bg-mak-green/10 hover:border-zinc-200 dark:hover:border-mak-green/30 transition" data-type="negative" data-msg="' + (messageId || '') + '" title="Not helpful">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
    html += '</button>';
    html += '<button class="copy-btn bg-transparent border border-transparent rounded p-1 px-1.5 cursor-pointer text-zinc-400 dark:text-zinc-500 flex items-center gap-1 text-xs hover:bg-zinc-100 dark:hover:bg-mak-green/10 hover:border-zinc-200 dark:hover:border-mak-green/30 transition" title="Copy">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    html += '</button>';
    html += '<button class="escalate-btn bg-transparent border border-transparent rounded p-1 px-1.5 cursor-pointer text-zinc-400 dark:text-zinc-500 flex items-center gap-1 text-xs hover:bg-zinc-100 dark:hover:bg-mak-green/10 hover:border-zinc-200 dark:hover:border-mak-green/30 transition" data-msg="' + (messageId || '') + '" title="Escalate to staff">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4-5 4 5"/></svg>';
    html += '</button>';
    html += '</div>';
    return html;
  },

  bindActions: function(div) {
    var self = this;

    div.querySelectorAll('.feedback-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.sendFeedback(btn.dataset.msg, btn.dataset.type);
        div.querySelectorAll('.feedback-btn').forEach(function(b) {
          b.classList.remove('!text-mak-green', '!text-mak-red');
        });
        btn.classList.add(btn.dataset.type === 'positive' ? '!text-mak-green' : '!text-mak-red');
      });
    });

    div.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var content = div.querySelector('.msg-content');
        if (content) {
          navigator.clipboard.writeText(content.textContent).then(function() {
            Utils.showToast('Copied to clipboard', 'success');
          });
        }
      });
    });

    div.querySelectorAll('.escalate-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.escalate(btn.dataset.msg);
      });
    });
  },

  sendFeedback: async function(messageId, type) {
    if (!messageId) return;
    try {
      await API.post('/messages/' + messageId + '/feedback', { type: type });
    } catch (e) {}
  },

  escalate: async function(messageId) {
    if (!messageId) return;
    var confirmed = await Utils.showConfirm('Escalate to staff', 'This will flag the response for review by university staff. Continue?');
    if (!confirmed) return;
    try {
      await API.post('/messages/' + messageId + '/escalate');
      Utils.showToast('Escalated to staff', 'success');
    } catch (e) {
      Utils.showToast('Failed to escalate', 'error');
    }
  },

  showTyping: function(show) {
    var el = document.getElementById('typing-indicator');
    if (show) {
      el.classList.remove('hidden');
      el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  },

  loadMemories: async function() {
    var list = document.getElementById('memories-list');
    try {
      var result = await API.get('/memories');
      var memories = result.memories || result || [];
      if (!memories.length) {
        list.innerHTML = '<div class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">No memories yet</div>';
        return;
      }
      var html = '';
      memories.forEach(function(m) {
        html += '<div class="flex items-start gap-3 p-3 bg-zinc-100 dark:bg-chat-canvas/80 dark:border dark:border-chat-line/60 rounded-lg">';
        html += '<div class="flex-1 text-sm text-zinc-700 dark:text-zinc-200">' + Utils.escapeHtml(m.content) + '</div>';
        html += '<button class="memory-delete shrink-0 w-6 h-6 rounded hover:bg-zinc-200 dark:hover:bg-mak-green/15 flex items-center justify-center text-zinc-400 bg-transparent border-none cursor-pointer transition" data-id="' + m.id + '">';
        html += '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        html += '</button></div>';
      });
      list.innerHTML = html;
      list.querySelectorAll('.memory-delete').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          try {
            await API.delete('/memories/' + btn.dataset.id);
            btn.closest('.flex').remove();
            Utils.showToast('Memory deleted', 'success');
          } catch (e) {
            Utils.showToast('Failed to delete memory', 'error');
          }
        });
      });
    } catch (e) {
      list.innerHTML = '<div class="text-sm text-zinc-500 text-center py-6">Failed to load memories</div>';
    }
  }
};

document.addEventListener('DOMContentLoaded', function() { Chat.init(); });
