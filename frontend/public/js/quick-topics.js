/**
 * AskMak Quick-Access Topics
 *
 * Renders a clean grid of topic chips in the welcome area using Feather icons.
 * Tapping a chip reveals a short list of common questions for that topic.
 * Tapping a question sends it through the normal Chat.sendMessage() pipeline,
 * so the bot answers in the chat just like any user-typed prompt.
 */
(function () {
  // Topic catalogue. Each entry shows up as a chip; clicking it reveals the
  // listed questions. The icon names map to Feather (https://feathericons.com).
  const TOPICS = [
    {
      key: 'acmis',
      label: 'ACMIS / Student portal',
      icon: 'user',
      questions: [
        'How do I log in to ACMIS (the student portal)?',
        'I forgot my ACMIS password — how do I reset it?',
        'How do I register for my courses on ACMIS?',
        'Where can I see my exam results on ACMIS?'
      ]
    },
    {
      key: 'webmail',
      label: 'Webmail',
      icon: 'mail',
      questions: [
        'How do I log in to my Makerere webmail?',
        'I forgot my university email password — how do I recover it?',
        'How do I set up my Makerere email on my phone?'
      ]
    },
    {
      key: 'fees',
      label: 'Fees & payments',
      icon: 'credit-card',
      questions: [
        'I paid my fees but they are not reflecting on the portal — what should I do?',
        'How do I check my fees balance?',
        'Where can I find my payment reference number (PRN)?',
        'What are the deadlines for tuition payment this semester?'
      ]
    },
    {
      key: 'wifi',
      label: 'Wi-Fi / Internet',
      icon: 'wifi',
      questions: [
        'How do I connect to Mak-Connect Wi-Fi?',
        'I cannot connect to Makerere Wi-Fi — how do I fix this?',
        'How do I sign in to eduroam at Makerere?'
      ]
    },
    {
      key: 'muele',
      label: 'MUELE (LMS)',
      icon: 'book-open',
      questions: [
        'How do I log in to MUELE?',
        'My course is not showing on MUELE — what should I do?',
        'How do I submit an assignment on MUELE?',
        'I cannot upload my file to MUELE — how do I fix it?'
      ]
    },
    {
      key: 'password',
      label: 'Password reset',
      icon: 'key',
      questions: [
        'How do I reset my Makerere account password?',
        'I forgot my student portal password — how do I recover it?',
        'My account is locked — how do I unlock it?'
      ]
    },
    {
      key: 'account',
      label: 'Account recovery',
      icon: 'life-buoy',
      questions: [
        'I think my account was hacked — what should I do?',
        'How do I recover my Makerere account if I lost access to email?',
        'I changed my phone number — how do I update my recovery details?'
      ]
    }
  ];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function paintFeather(scope) {
    if (typeof window === 'undefined' || typeof window.feather === 'undefined') return;
    try {
      // Feather 4 replaces *all* [data-feather] markers in the document.
      // Scoping by re-replace is fine — it only touches nodes that still
      // carry the data-feather attribute (replaced nodes lose it).
      window.feather.replace({ 'stroke-width': 2 });
    } catch (_) {
      /* ignore */
    }
    void scope;
  }

  function renderChips(grid, questionsHost) {
    grid.innerHTML = '';
    TOPICS.forEach((topic) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.topic = topic.key;
      btn.setAttribute('aria-expanded', 'false');
      btn.className = [
        'group',
        'flex items-center gap-2.5',
        'w-full min-h-[2.75rem] sm:min-h-[2.5rem]',
        'px-3 py-2 rounded-xl',
        'border border-zinc-200 dark:border-white/10',
        'bg-white dark:bg-white/[0.04]',
        'text-left text-[13px] sm:text-xs font-medium',
        'text-zinc-700 dark:text-zinc-300',
        'hover:border-mak-green/50 hover:bg-mak-green/5',
        'dark:hover:bg-mak-green/10',
        'hover:text-mak-green dark:hover:text-mak-green',
        'transition shadow-sm cursor-pointer'
      ].join(' ');

      const iconWrap = document.createElement('span');
      iconWrap.className = [
        'shrink-0 inline-flex h-7 w-7 items-center justify-center',
        'rounded-lg bg-mak-green/10 text-mak-green',
        'dark:bg-mak-green/15 dark:text-mak-green',
        'group-hover:bg-mak-green/20 transition'
      ].join(' ');
      const ico = document.createElement('i');
      ico.setAttribute('data-feather', topic.icon);
      ico.setAttribute('width', '15');
      ico.setAttribute('height', '15');
      ico.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(ico);

      const labelEl = document.createElement('span');
      labelEl.className = 'truncate';
      labelEl.textContent = topic.label;

      btn.appendChild(iconWrap);
      btn.appendChild(labelEl);

      btn.addEventListener('click', () => showQuestions(topic, btn, grid, questionsHost));
      grid.appendChild(btn);
    });

    paintFeather(grid);
  }

  function setActiveChip(grid, activeKey) {
    grid.querySelectorAll('button[data-topic]').forEach((b) => {
      const isActive = activeKey != null && b.dataset.topic === activeKey;
      b.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      if (isActive) {
        b.classList.add('border-mak-green/60', 'text-mak-green', 'bg-mak-green/10', 'dark:bg-mak-green/15');
      } else {
        b.classList.remove('border-mak-green/60', 'text-mak-green', 'bg-mak-green/10', 'dark:bg-mak-green/15');
      }
    });
  }

  /** Collapse any open question list and return focus to the topic grid (e.g. after #quick-topics deep link). */
  function resetToGrid() {
    const grid = document.getElementById('quick-topics-grid');
    const host = document.getElementById('quick-topics-questions');
    if (!grid || !host) return;
    host.innerHTML = '';
    host.classList.add('hidden');
    setActiveChip(grid, null);
  }

  function showQuestions(topic, chipEl, grid, host) {
    setActiveChip(grid, topic.key);
    host.innerHTML = '';
    host.classList.remove('hidden');

    const header = document.createElement('div');
    header.className = 'flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-1 pb-1';
    const headerIcon = document.createElement('i');
    headerIcon.setAttribute('data-feather', topic.icon);
    headerIcon.setAttribute('width', '12');
    headerIcon.setAttribute('height', '12');
    headerIcon.setAttribute('aria-hidden', 'true');
    const headerText = document.createElement('span');
    headerText.textContent = 'Common ' + topic.label + ' questions';
    header.appendChild(headerIcon);
    header.appendChild(headerText);
    host.appendChild(header);

    topic.questions.forEach((q) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'group',
        'flex items-start gap-2 w-full text-left',
        'px-4 py-3 rounded-xl',
        'border border-zinc-200 dark:border-white/10',
        'bg-white/80 dark:bg-white/5',
        'hover:bg-mak-green/5 dark:hover:bg-mak-green/10',
        'hover:border-mak-green/30 dark:hover:border-mak-green/30',
        'text-sm font-medium text-zinc-800 dark:text-zinc-200',
        'transition shadow-sm cursor-pointer'
      ].join(' ');

      const chevWrap = document.createElement('span');
      chevWrap.className = 'mt-0.5 shrink-0 text-zinc-400 group-hover:text-mak-green transition';
      const chev = document.createElement('i');
      chev.setAttribute('data-feather', 'message-circle');
      chev.setAttribute('width', '14');
      chev.setAttribute('height', '14');
      chev.setAttribute('aria-hidden', 'true');
      chevWrap.appendChild(chev);

      const qText = document.createElement('span');
      qText.textContent = q;

      btn.appendChild(chevWrap);
      btn.appendChild(qText);
      btn.addEventListener('click', () => askQuestion(q));
      host.appendChild(btn);
    });

    paintFeather(host);
  }

  function askQuestion(question) {
    if (!window.Chat || typeof Chat.sendMessage !== 'function') {
      console.warn('[quick-topics] Chat module not ready yet.');
      return;
    }
    const input = document.getElementById('message-input');
    if (!input) return;
    input.value = question;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    Chat.sendMessage();
  }

  function handleQuickTopicsHash() {
    if (window.location.hash !== '#quick-topics') return;
    if (window.Chat && typeof Chat.focusQuickAccess === 'function') {
      Chat.focusQuickAccess();
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  ready(() => {
    const grid = document.getElementById('quick-topics-grid');
    const host = document.getElementById('quick-topics-questions');
    if (!grid || !host) return;
    renderChips(grid, host);
    handleQuickTopicsHash();
    window.addEventListener('hashchange', handleQuickTopicsHash);
  });

  window.AskMakQuickTopics = { resetToGrid: resetToGrid };
})();
