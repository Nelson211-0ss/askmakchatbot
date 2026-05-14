/**
 * AskMak Knowledge Base & Ticketing Client Module
 * Handles category/title drill-down in the welcome screen, answer rendering in chat, and ticket submission.
 */

const KB = (function() {
    let currentCategory = null;
    let cachedCategories = null;

    // DOM Elements
    const els = {
        section: () => document.getElementById('kb-section'),
        nav: () => document.getElementById('kb-nav'),
        backBtn: () => document.getElementById('kb-back-btn'),
        breadcrumb: () => document.getElementById('kb-breadcrumb'),
        categories: () => document.getElementById('kb-categories'),
        titles: () => document.getElementById('kb-titles'),
        ticketWrap: () => document.getElementById('kb-ticket-wrap'),
        ticketBtn: () => document.getElementById('kb-ticket-btn'),
        ticketModal: () => document.getElementById('kb-ticket-modal'),
        ticketModalClose: () => document.getElementById('kb-ticket-modal-close'),
        ticketForm: () => document.getElementById('kb-ticket-form'),
        ticketCategory: () => document.getElementById('kt-category'),
        ticketTitle: () => document.getElementById('kt-title'),
        ticketEmail: () => document.getElementById('kt-email'),
        ticketError: () => document.getElementById('kb-ticket-error'),
        ticketSubmit: () => document.getElementById('kb-ticket-submit'),
        ticketSuccess: () => document.getElementById('kb-ticket-success')
    };

    function init() {
        // Only initialize if we're on the chat page
        if (!els.ticketBtn()) return;

        // Reflect current auth state on the ticket button (label/title/icon).
        applyAuthStateToTicketBtn();
        if (window.Auth && Auth.isAuthenticated && Auth.isAuthenticated() && Auth.user) {
            show(Auth.user);
        }
        window.addEventListener('auth:ready', (e) => {
            applyAuthStateToTicketBtn();
            if (e.detail && e.detail.isAuthenticated && e.detail.user) {
                show(e.detail.user);
            }
        });

        setupEventListeners();
        maybeOpenTicketFromHash();
        window.addEventListener('hashchange', maybeOpenTicketFromHash);
    }

    /** Deep link: `.../chat.html#support-ticket` opens the ticket modal (matches assistant markdown links). */
    function maybeOpenTicketFromHash() {
        if (window.location.hash !== '#support-ticket') return;
        openTicketModal();
        if (window.location.hash === '#support-ticket') {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    /** Show the ticket link only when a student is signed in; hide for guests. */
    function applyAuthStateToTicketBtn() {
        const wrap = els.ticketWrap();
        const btn = els.ticketBtn();
        if (!wrap) return;
        const signedIn = !!(window.Auth && Auth.isAuthenticated && Auth.isAuthenticated());
        wrap.classList.toggle('hidden', !signedIn);
        if (btn) {
            btn.dataset.requiresLogin = signedIn ? 'false' : 'true';
            btn.title = 'Submit a support ticket';
        }
    }

    /** Show the KB section and load categories for the given authenticated user.
     * NOTE: The legacy welcome-screen drill-down (category → titles) has been
     * replaced by the AskMak quick-access topic grid (see quick-topics.js).
     * We keep this function as a no-op shell so older callers don't break, but
     * we do NOT re-show the legacy KB section or fetch categories. The only
     * thing still wired up here is the ticket modal (handlers below).
     */
    function show(user) {
        if (els.ticketEmail() && user && user.email) {
            els.ticketEmail().value = user.email;
        }
    }

    function setupEventListeners() {
        if (els.backBtn()) {
            els.backBtn().addEventListener('click', showCategories);
        }

        if (els.ticketBtn()) {
            els.ticketBtn().addEventListener('click', () => openTicketModal());
        }

        if (els.ticketModalClose()) {
            els.ticketModalClose().addEventListener('click', closeTicketModal);
        }

        if (els.ticketForm()) {
            els.ticketForm().addEventListener('submit', handleTicketSubmit);
        }
    }

    async function loadCategories() {
        try {
            if (cachedCategories) {
                renderCategories(cachedCategories);
                return;
            }

            const res = await fetch('/api/kb/categories');
            if (!res.ok) throw new Error('Failed to load categories');
            
            const data = await res.json();
            cachedCategories = data.categories || [];
            renderCategories(cachedCategories);
        } catch (err) {
            console.error('[KB]', err);
            els.categories().innerHTML = '<span class="text-xs text-red-400">Unable to load topics.</span>';
        }
    }

    function renderCategories(categories) {
        const container = els.categories();
        if (!categories.length) {
            container.innerHTML = '<span class="text-xs text-zinc-400">No topics available.</span>';
            return;
        }

        container.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-mak-green/50 hover:bg-mak-green/5 dark:hover:bg-mak-green/10 hover:text-mak-green dark:hover:text-mak-green transition shadow-sm cursor-pointer';
            btn.textContent = cat;
            btn.addEventListener('click', () => loadTitles(cat));
            container.appendChild(btn);
        });
    }

    function showCategories() {
        currentCategory = null;
        els.backBtn().classList.add('hidden');
        els.backBtn().classList.remove('flex');
        els.breadcrumb().textContent = '';
        els.titles().classList.add('hidden');
        els.categories().classList.remove('hidden');
    }

    async function loadTitles(category) {
        currentCategory = category;
        els.categories().classList.add('hidden');
        els.titles().innerHTML = '<div class="text-xs text-center text-zinc-400 py-2 animate-pulse">Loading questions…</div>';
        els.titles().classList.remove('hidden');
        
        els.breadcrumb().textContent = category;
        els.backBtn().classList.remove('hidden');
        els.backBtn().classList.add('flex');  // ensure flex display when unhidden

        try {
            const res = await fetch('/api/kb/categories/' + encodeURIComponent(category));
            if (!res.ok) throw new Error('Failed to load titles');
            const data = await res.json();
            
            const container = els.titles();
            container.innerHTML = '';
            
            if (!data.entries || !data.entries.length) {
                container.innerHTML = '<div class="text-xs text-center text-zinc-500 py-2">No questions found in this category.</div>';
                return;
            }

            data.entries.forEach(entry => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-mak-green/5 dark:hover:bg-mak-green/10 hover:border-mak-green/30 dark:hover:border-mak-green/30 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition shadow-sm cursor-pointer';
                btn.textContent = entry.title;
                btn.addEventListener('click', () => loadAnswer(entry.id, entry.title));
                container.appendChild(btn);
            });
        } catch (err) {
            console.error('[KB]', err);
            els.titles().innerHTML = '<div class="text-xs text-center text-red-400 py-2">Failed to load questions.</div>';
        }
    }

    async function loadAnswer(id, title) {
        if (!window.Chat) return;

        // Switch to chat view and show the user's question as a bubble
        Chat.switchToChat();
        Chat.appendMessage(
            { role: 'user', content: title, created_at: new Date().toISOString() },
            true
        );

        // Show typing indicator while fetching
        Chat.showTyping(true);

        try {
            const res = await fetch('/api/kb/entries/' + id);
            if (!res.ok) throw new Error('Failed to load answer');
            const data = await res.json();

            Chat.showTyping(false);

            // Render the KB answer as an assistant message
            Chat.appendMessage(
                { role: 'assistant', content: data.entry.content, created_at: new Date().toISOString() },
                true
            );
        } catch (err) {
            console.error('[KB]', err);
            Chat.showTyping(false);
            if (window.Utils) {
                Utils.showToast('Could not load answer. Please try again.', 'error');
            }
        }
    }

    /** Returns true if the user is signed in; otherwise nudges them to log in
     * (toast + redirect to /login.html, preserving return URL). */
    function ensureSignedIn() {
        const signedIn = !!(window.Auth && Auth.isAuthenticated && Auth.isAuthenticated() && Auth.user);
        if (signedIn) return true;
        if (window.Utils && typeof Utils.showToast === 'function') {
            Utils.showToast('Sign in with your student account to submit a support ticket.', 'info');
        }
        const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        // Small delay so the toast is visible before navigation.
        setTimeout(() => { window.location.href = '/login.html?next=' + next; }, 700);
        return false;
    }

    function openTicketModal(categoryPrefill = null) {
        // Hard gate: only authenticated students may open the ticket form.
        if (!ensureSignedIn()) return;

        const cat = categoryPrefill || currentCategory || '';
        els.ticketCategory().value = cat;
        els.ticketTitle().value = '';
        els.ticketError().classList.add('hidden');
        els.ticketForm().classList.remove('hidden');
        els.ticketSuccess().classList.add('hidden');
        els.ticketSubmit().disabled = false;

        // Lock the email field to the signed-in account's email. The server
        // identifies the student from the JWT, so this is purely informational.
        const emailEl = els.ticketEmail();
        if (emailEl && window.Auth && Auth.user && Auth.user.email) {
            emailEl.value = Auth.user.email;
            emailEl.readOnly = true;
            emailEl.classList.add('opacity-70', 'cursor-not-allowed');
        }

        els.ticketModal().classList.remove('hidden');
        setTimeout(() => els.ticketTitle().focus(), 100);
    }

    function closeTicketModal() {
        els.ticketModal().classList.add('hidden');
    }

    async function handleTicketSubmit(e) {
        e.preventDefault();

        // Re-verify auth at submit time in case the session expired
        // between opening the modal and submitting.
        if (!ensureSignedIn()) return;

        const category = els.ticketCategory().value.trim();
        const title = els.ticketTitle().value.trim();

        if (!category || !title) {
            showTicketError('Please fill in the category and your question.');
            return;
        }

        els.ticketError().classList.add('hidden');
        els.ticketSubmit().disabled = true;
        els.ticketSubmit().textContent = 'Submitting...';

        try {
            const res = await fetch('/api/kb/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin', // send auth cookie
                body: JSON.stringify({ category, title })
            });

            const data = await res.json();

            if (res.status === 401) {
                throw new Error('Your session has expired. Please sign in again.');
            }
            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit ticket');
            }

            // Show success state
            els.ticketForm().classList.add('hidden');
            els.ticketSuccess().classList.remove('hidden');

            // Auto close after 3 seconds
            setTimeout(closeTicketModal, 3000);
        } catch (err) {
            console.error('[KB]', err);
            showTicketError(err.message || 'Something went wrong. Please try again.');
        } finally {
            els.ticketSubmit().disabled = false;
            els.ticketSubmit().textContent = 'Submit Ticket';
        }
    }

    function showTicketError(msg) {
        const errEl = els.ticketError();
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
    }

    return {
        init,
        show,
        openTicketModal
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', KB.init);
} else {
    KB.init();
}
