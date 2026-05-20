/**
 * AskMak Quick-Access Topics (Dynamic from Knowledge Base)
 *
 * Fetches categories and titles dynamically from the kb_entries database.
 * Renders categories as topic chips, and titles as question buttons.
 * Clicking a title button sends the question to the LLM.
 */
(function () {
  const ICON_MAPPING = {
    'it': 'cpu',
    'admissions': 'award',
    'programs': 'layers',
    'fees': 'credit-card',
    'general': 'globe',
    'acmis': 'user',
    'webmail': 'mail',
    'wifi': 'wifi',
    'muele': 'book-open',
    'password': 'key',
    'other': 'help-circle'
  };

  let activeCategory = null;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function getIcon(category) {
    const key = (category || '').toLowerCase().trim();
    return ICON_MAPPING[key] || 'help-circle';
  }

  function paintFeather(scope) {
    if (typeof window === 'undefined' || typeof window.feather === 'undefined') return;
    try {
      window.feather.replace({ 'stroke-width': 2 });
    } catch (_) {
      /* ignore */
    }
    void scope;
  }

  async function loadAndRenderCategories(grid, questionsHost) {
    grid.innerHTML = '<div class="col-span-full text-center text-xs text-zinc-400 py-4 animate-pulse">Loading topics…</div>';
    
    try {
      const res = await fetch('/api/kb/categories');
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      
      const categories = data.categories || [];
      if (!categories.length) {
        grid.innerHTML = '<div class="col-span-full text-center text-xs text-zinc-400 py-4">No topics available.</div>';
        return;
      }

      grid.innerHTML = '';
      categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.topic = cat;
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
        ico.setAttribute('data-feather', getIcon(cat));
        ico.setAttribute('width', '15');
        ico.setAttribute('height', '15');
        ico.setAttribute('aria-hidden', 'true');
        iconWrap.appendChild(ico);

        const labelEl = document.createElement('span');
        labelEl.className = 'truncate';
        labelEl.textContent = cat;

        btn.appendChild(iconWrap);
        btn.appendChild(labelEl);

        btn.addEventListener('click', () => handleCategoryClick(cat, btn, grid, questionsHost));
        grid.appendChild(btn);
      });

      paintFeather(grid);
    } catch (err) {
      console.error('[QuickTopics]', err);
      grid.innerHTML = '<div class="col-span-full text-center text-xs text-red-400 py-4">Failed to load help topics.</div>';
    }
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

  function resetToGrid() {
    const grid = document.getElementById('quick-topics-grid');
    const host = document.getElementById('quick-topics-questions');
    if (!grid || !host) return;
    host.innerHTML = '';
    host.classList.add('hidden');
    setActiveChip(grid, null);
    activeCategory = null;
  }

  async function handleCategoryClick(category, chipEl, grid, host) {
    if (activeCategory === category) {
      resetToGrid();
      return;
    }

    activeCategory = category;
    setActiveChip(grid, category);
    host.innerHTML = '<div class="text-xs text-center text-zinc-400 py-4 animate-pulse">Loading questions…</div>';
    host.classList.remove('hidden');

    try {
      const res = await fetch('/api/kb/categories/' + encodeURIComponent(category));
      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();

      host.innerHTML = '';
      const entries = data.entries || [];
      if (!entries.length) {
        host.innerHTML = '<div class="text-xs text-zinc-400 py-2">No questions found in this category.</div>';
        return;
      }

      const header = document.createElement('div');
      header.className = 'flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-1 pb-1';
      const headerIcon = document.createElement('i');
      headerIcon.setAttribute('data-feather', getIcon(category));
      headerIcon.setAttribute('width', '12');
      headerIcon.setAttribute('height', '12');
      headerIcon.setAttribute('aria-hidden', 'true');
      const headerText = document.createElement('span');
      headerText.textContent = 'Common ' + category + ' questions';
      header.appendChild(headerIcon);
      header.appendChild(headerText);
      host.appendChild(header);

      entries.forEach((entry) => {
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
        qText.textContent = entry.title;

        btn.appendChild(chevWrap);
        btn.appendChild(qText);
        btn.addEventListener('click', () => askQuestion(entry.title));
        host.appendChild(btn);
      });

      paintFeather(host);
    } catch (err) {
      console.error('[QuickTopics]', err);
      host.innerHTML = '<div class="text-xs text-red-400 py-2">Failed to load questions.</div>';
    }
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
    loadAndRenderCategories(grid, host);
    handleQuickTopicsHash();
    window.addEventListener('hashchange', handleQuickTopicsHash);
  });

  window.AskMakQuickTopics = { resetToGrid: resetToGrid };
})();
