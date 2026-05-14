/**
 * AskMak Quick-Access Topics
 *
 * Renders a grid of topic chips in the welcome area. Tapping a chip reveals
 * a short list of common questions for that topic. Tapping a question sends
 * it through the normal Chat.sendMessage() pipeline so the bot answers in
 * the chat just like any user-typed prompt.
 *
 * The module replaces the previous KB category drill-down ("Course" pill).
 */
(function () {
  // Topic catalogue. Each topic shows up as a chip; clicking it reveals the
  // listed questions. Pick the questions carefully so they match what the
  // backend knowledge base / chat API can actually answer.
  const TOPICS = [
    {
      key: 'acmis',
      label: 'ACMIS / Student portal',
      icon: '🎓',
      questions: [
        'How do I log in to ACMIS (the student portal)?',
        'I forgot my ACMIS password — how do I reset it?',
        'How do I register for my courses on ACMIS?',
        'Where can I see my exam results on ACMIS?'
      ]
    },
    {
      key: 'webmail',
      label: 'University webmail',
      icon: '✉️',
      questions: [
        'How do I log in to my Makerere webmail?',
        'I forgot my university email password — how do I recover it?',
        'How do I set up my Makerere email on my phone?'
      ]
    },
    {
      key: 'fees',
      label: 'Fees & payments',
      icon: '💳',
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
      icon: '📶',
      questions: [
        'How do I connect to Mak-Connect Wi-Fi?',
        'I cannot connect to Makerere Wi-Fi — how do I fix this?',
        'How do I sign in to eduroam at Makerere?'
      ]
    },
    {
      key: 'muele',
      label: 'MUELE (LMS)',
      icon: '📘',
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
      icon: '🔐',
      questions: [
        'How do I reset my Makerere account password?',
        'I forgot my student portal password — how do I recover it?',
        'My account is locked — how do I unlock it?'
      ]
    },
    {
      key: 'account',
      label: 'Account recovery',
      icon: '🆘',
      questions: [
        'I think my account was hacked — what should I do?',
        'How do I recover my Makerere account if I lost access to email?',
        'I changed my phone number — how do I update my recovery details?'
      ]
    },
    {
      key: 'admissions',
      label: 'Admissions',
      icon: '🎟️',
      questions: [
        'How do I check my admission status?',
        'What documents do I need to report for admission?',
        'How do I apply for a Makerere programme?'
      ]
    },
    {
      key: 'courses',
      label: 'Courses & registration',
      icon: '📚',
      questions: [
        'How do I register for courses this semester?',
        'How do I add or drop a course?',
        'Where can I see my registered courses?'
      ]
    },
    {
      key: 'contact',
      label: 'Contact ICT support',
      icon: '☎️',
      questions: [
        'How do I contact DICTS / the ICT helpdesk?',
        'What are the helpdesk working hours?',
        'Where is the ICT helpdesk located on campus?'
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

  function renderChips(grid, questionsHost) {
    grid.innerHTML = '';
    TOPICS.forEach((topic) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.topic = topic.key;
      btn.setAttribute('aria-expanded', 'false');
      btn.className = [
        'inline-flex items-center gap-1.5',
        'px-3 py-1.5 rounded-full',
        'border border-zinc-200 dark:border-white/10',
        'bg-white dark:bg-white/5',
        'text-xs font-medium text-zinc-700 dark:text-zinc-300',
        'hover:border-mak-green/50 hover:bg-mak-green/5',
        'dark:hover:bg-mak-green/10 hover:text-mak-green dark:hover:text-mak-green',
        'transition shadow-sm cursor-pointer'
      ].join(' ');
      btn.innerHTML =
        '<span aria-hidden="true">' + topic.icon + '</span>' +
        '<span>' + topic.label + '</span>';
      btn.addEventListener('click', () => showQuestions(topic, btn, grid, questionsHost));
      grid.appendChild(btn);
    });
  }

  function setActiveChip(grid, activeKey) {
    grid.querySelectorAll('button[data-topic]').forEach((b) => {
      const isActive = b.dataset.topic === activeKey;
      b.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      if (isActive) {
        b.classList.add('border-mak-green/60', 'text-mak-green', 'bg-mak-green/10', 'dark:bg-mak-green/15');
      } else {
        b.classList.remove('border-mak-green/60', 'text-mak-green', 'bg-mak-green/10', 'dark:bg-mak-green/15');
      }
    });
  }

  function showQuestions(topic, chipEl, grid, host) {
    setActiveChip(grid, topic.key);
    host.innerHTML = '';
    host.classList.remove('hidden');

    const label = document.createElement('div');
    label.className = 'text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-1 pb-1';
    label.textContent = 'Common ' + topic.label + ' questions';
    host.appendChild(label);

    topic.questions.forEach((q) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'w-full text-left px-4 py-3 rounded-xl',
        'border border-zinc-200 dark:border-white/10',
        'bg-white/80 dark:bg-white/5',
        'hover:bg-mak-green/5 dark:hover:bg-mak-green/10',
        'hover:border-mak-green/30 dark:hover:border-mak-green/30',
        'text-sm font-medium text-zinc-800 dark:text-zinc-200',
        'transition shadow-sm cursor-pointer'
      ].join(' ');
      btn.textContent = q;
      btn.addEventListener('click', () => askQuestion(q));
      host.appendChild(btn);
    });
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

  ready(() => {
    const grid = document.getElementById('quick-topics-grid');
    const host = document.getElementById('quick-topics-questions');
    if (!grid || !host) return;
    renderChips(grid, host);
  });
})();
