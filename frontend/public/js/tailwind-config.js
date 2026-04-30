tailwind.config = {
  darkMode: 'class',
  /* Referenced from chat.js / sidebar.js strings (CDN JIT does not always scan those files). */
  safelist: [
    'dark:bg-chat-canvas',
    'dark:bg-chat-raised',
    'dark:bg-chat-sidebar',
    'dark:border-chat-line',
    'dark:bg-chat-raised/95',
    'dark:border-chat-line/90',
    'dark:bg-chat-canvas/80',
    'dark:border-chat-line/60',
    'dark:bg-mak-green',
    'dark:bg-mak-green/35',
    'dark:border-mak-green/40',
    'dark:bg-mak-green/70',
    'dark:hover:bg-mak-green/10',
    'dark:hover:bg-mak-green/12',
    'dark:hover:bg-mak-green/15',
    'dark:hover:border-mak-green/30',
    'dark:bg-mak-green/[0.14]',
    'dark:placeholder-mak-green/40',
    'dark:text-mak-green/80',
    'dark:text-mak-green/55',
    'dark:text-mak-green/50',
    'dark:prose-pre:bg-chat-sidebar/80',
    'dark:bg-mak-green/[0.08]',
    'dark:shadow-[0_0_20px_-4px_rgba(0,166,81,0.45)]',
    'prose-sans',
    'prose-a:text-mak-green',
    'dark:prose-a:text-mak-green',
    'prose-headings:font-semibold',
    'dark:prose-headings:text-zinc-50',
    'dark:prose-strong:text-white',
    'dark:prose-code:text-mak-green/95',
  ],
  theme: {
    extend: {
      colors: {
        mak: {
          red: '#ed1c24',
          dark: '#231F20',
          green: '#00a651',
          gold: '#d2ab67',
          gray: '#cdcccb',
        },
        /* Chat dark mode: same deep green-wash family as index.html hero (.home-chatbot-bg dark) */
        chat: {
          canvas: '#0a1210',
          raised: '#0f1c18',
          sidebar: '#071512',
          line: '#1c3d2f',
        },
      },
      fontFamily: {
        /* Matches :root --font-sans in css/styles.css */
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'typing-bounce': 'typingBounce 1.4s infinite',
        'fade-in': 'fadeIn 0.3s ease',
        'toast-in': 'toastIn 0.3s ease',
        'modal-in': 'modalIn 0.2s ease',
        'hero-title': 'heroReveal 0.85s cubic-bezier(0.16, 1, 0.3, 1) both',
        'hero-sub': 'heroReveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both',
        'hero-cta': 'heroReveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both',
      },
      keyframes: {
        heroReveal: {
          from: { opacity: '0', transform: 'translateY(1.35rem) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        typingBounce: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-6px)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        toastIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        modalIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
    }
  }
}
