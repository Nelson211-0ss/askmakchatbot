/** @jest-environment jsdom */

const { Utils } = require('./loadUtils');

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('escapeHtml', () => {
  test('escapes tags and ampersands', () => {
    expect(Utils.escapeHtml('<script>alert("x")</script> & co'))
      .toBe('&lt;script&gt;alert("x")&lt;/script&gt; &amp; co');
  });

  test('leaves plain text untouched', () => {
    expect(Utils.escapeHtml('hello world')).toBe('hello world');
  });
});

describe('truncate', () => {
  test('returns text unchanged when at or under the limit', () => {
    expect(Utils.truncate('hello', 5)).toBe('hello');
    expect(Utils.truncate('hi', 5)).toBe('hi');
  });

  test('truncates and appends ellipsis when over the limit', () => {
    expect(Utils.truncate('hello world', 5)).toBe('hello...');
  });

  test('passes through falsy input', () => {
    expect(Utils.truncate('', 5)).toBe('');
    expect(Utils.truncate(null, 5)).toBe(null);
  });
});

describe('getInitials', () => {
  test('uses first letter of first two words', () => {
    expect(Utils.getInitials('Kiggundu Alvin')).toBe('KA');
  });

  test('single word yields one letter', () => {
    expect(Utils.getInitials('Alvin')).toBe('A');
  });

  test('falsy name yields a placeholder', () => {
    expect(Utils.getInitials('')).toBe('?');
    expect(Utils.getInitials(null)).toBe('?');
  });
});

describe('dedupeSupportTicketLink', () => {
  const LINK = '[Submit a support ticket](#support-ticket)';

  test('leaves text with no ticket link untouched', () => {
    const text = 'Please contact the registrar.';
    expect(Utils.dedupeSupportTicketLink(text)).toBe(text);
  });

  test('leaves a single ticket link untouched', () => {
    const text = `Try this first.\n\n${LINK}`;
    expect(Utils.dedupeSupportTicketLink(text)).toBe(text);
  });

  test('collapses repeated ticket links into one trailing link', () => {
    const text = `First try this.\n\n${LINK}\n\nThen this.\n\n${LINK}`;
    const result = Utils.dedupeSupportTicketLink(text);
    expect(result.match(/\[Submit a support ticket\]/g)).toHaveLength(1);
    expect(result.endsWith(LINK)).toBe(true);
    expect(result).toBe(`First try this.\n\nThen this.\n\n${LINK}`);
  });

  test('passes through falsy input', () => {
    expect(Utils.dedupeSupportTicketLink('')).toBe('');
    expect(Utils.dedupeSupportTicketLink(null)).toBe(null);
  });
});

describe('renderMarkdown', () => {
  test('renders basic markdown to sanitized HTML', () => {
    const html = Utils.renderMarkdown('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  test('strips disallowed/dangerous tags and attributes', () => {
    const html = Utils.renderMarkdown('<script>alert(1)</script>\n\nsafe text');
    expect(html).not.toContain('<script>');
    expect(html).toContain('safe text');
  });

  test('external links get target=_blank and rel=noopener', () => {
    const html = Utils.renderMarkdown('[Makerere](https://mak.ac.ug)');
    expect(html).toMatch(/<a target="_blank" rel="noopener" href="https:\/\/mak\.ac\.ug">Makerere<\/a>/);
  });

  test('in-page anchors (#...) do not get target=_blank', () => {
    const html = Utils.renderMarkdown('[jump](#quick-topics)');
    expect(html).not.toContain('target="_blank"');
  });

  test('quick-topics anchor gets its CTA class', () => {
    const html = Utils.renderMarkdown('[See topics](#quick-topics)');
    expect(html).toMatch(/class="askmak-cta-link askmak-cta-link--topics"/);
  });

  test('support-ticket anchor gets its CTA class', () => {
    const html = Utils.renderMarkdown('[Submit a support ticket](#support-ticket)');
    expect(html).toMatch(/class="askmak-cta-link askmak-cta-link--ticket"/);
  });

  test('deduplicates repeated support-ticket links before rendering', () => {
    const LINK = '[Submit a support ticket](#support-ticket)';
    const html = Utils.renderMarkdown(`Try this.\n\n${LINK}\n\nOr this.\n\n${LINK}`);
    expect(html.match(/askmak-cta-link--ticket/g)).toHaveLength(1);
  });

  test('returns empty string for falsy input', () => {
    expect(Utils.renderMarkdown('')).toBe('');
    expect(Utils.renderMarkdown(null)).toBe('');
  });

  test('falls back to escaped text with <br> when marked/DOMPurify are unavailable', () => {
    const savedMarked = global.marked;
    const savedPurify = global.DOMPurify;
    delete global.marked;
    delete global.DOMPurify;
    try {
      expect(Utils.renderMarkdown('line one\nline two <b>')).toBe(
        'line one<br>line two &lt;b&gt;'
      );
    } finally {
      global.marked = savedMarked;
      global.DOMPurify = savedPurify;
    }
  });
});

describe('formatTime (relative)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('just now for under a minute', () => {
    expect(Utils.formatTime('2026-07-14T11:59:30Z')).toBe('Just now');
  });

  test('minutes ago', () => {
    expect(Utils.formatTime('2026-07-14T11:45:00Z')).toBe('15m ago');
  });

  test('hours ago', () => {
    expect(Utils.formatTime('2026-07-14T09:00:00Z')).toBe('3h ago');
  });

  test('days ago (under a week)', () => {
    expect(Utils.formatTime('2026-07-12T12:00:00Z')).toBe('2d ago');
  });

  test('falls back to a short date at a week or older', () => {
    expect(Utils.formatTime('2026-07-01T12:00:00Z')).toBe('Jul 1');
  });
});

describe('formatClockTime', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T15:30:00'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('same-day timestamp shows only the time', () => {
    const result = Utils.formatClockTime(new Date('2026-07-14T10:42:00'));
    expect(result).not.toContain('Yesterday');
    expect(result).not.toContain(',');
  });

  test('yesterday is prefixed', () => {
    const result = Utils.formatClockTime(new Date('2026-07-13T10:42:00'));
    expect(result.startsWith('Yesterday ')).toBe(true);
  });

  test('older dates include the date', () => {
    const result = Utils.formatClockTime(new Date('2026-05-14T10:42:00'));
    expect(result).toMatch(/^May 14, /);
  });

  test('missing or invalid input returns empty string', () => {
    expect(Utils.formatClockTime('')).toBe('');
    expect(Utils.formatClockTime(null)).toBe('');
    expect(Utils.formatClockTime('not-a-date')).toBe('');
  });
});

describe('groupByDate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('buckets items into today/yesterday/week/older', () => {
    const items = [
      { id: 'today', updated_at: '2026-07-14T09:00:00' },
      { id: 'yesterday', updated_at: '2026-07-13T09:00:00' },
      { id: 'thisWeek', updated_at: '2026-07-10T09:00:00' },
      { id: 'older', updated_at: '2026-06-01T09:00:00' }
    ];
    const groups = Utils.groupByDate(items);
    expect(groups.today.map((i) => i.id)).toEqual(['today']);
    expect(groups.yesterday.map((i) => i.id)).toEqual(['yesterday']);
    expect(groups.week.map((i) => i.id)).toEqual(['thisWeek']);
    expect(groups.older.map((i) => i.id)).toEqual(['older']);
  });

  test('falls back to created_at when updated_at is missing', () => {
    const groups = Utils.groupByDate([{ id: 'x', created_at: '2026-07-14T09:00:00' }]);
    expect(groups.today.map((i) => i.id)).toEqual(['x']);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('only invokes once after rapid successive calls, with the last args', () => {
    const fn = jest.fn();
    const debounced = Utils.debounce(fn, 200);

    debounced('first');
    debounced('second');
    debounced('third');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  test('invokes again after the delay elapses between calls', () => {
    const fn = jest.fn();
    const debounced = Utils.debounce(fn, 200);

    debounced('a');
    jest.advanceTimersByTime(200);
    debounced('b');
    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });
});

describe('copyTextToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  const originalIsSecureContext = window.isSecureContext;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: originalIsSecureContext, configurable: true });
    delete document.execCommand;
  });

  test('resolves false for empty text without touching the DOM', async () => {
    await expect(Utils.copyTextToClipboard('')).resolves.toBe(false);
  });

  test('uses the Clipboard API on a secure context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    await expect(Utils.copyTextToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  test('falls back to execCommand when the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = jest.fn().mockReturnValue(true);

    await expect(Utils.copyTextToClipboard('hello')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  test('falls back to execCommand when the Clipboard API write rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    document.execCommand = jest.fn().mockReturnValue(true);

    await expect(Utils.copyTextToClipboard('hello')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  test('fallback resolves false when execCommand fails or throws', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = jest.fn(() => { throw new Error('nope'); });

    await expect(Utils.copyTextToClipboard('hello')).resolves.toBe(false);
  });
});

describe('showToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates a toast container on first use and appends the message', () => {
    Utils.showToast('Saved successfully', 'success');
    const container = document.getElementById('toast-container');
    expect(container).not.toBeNull();
    expect(container.children).toHaveLength(1);
    expect(container.children[0].textContent).toBe('Saved successfully');
    expect(container.children[0].className).toContain('bg-mak-green');
  });

  test('reuses the existing container for subsequent toasts', () => {
    Utils.showToast('One', 'error');
    Utils.showToast('Two', 'info');
    const container = document.getElementById('toast-container');
    expect(container.children).toHaveLength(2);
    expect(container.children[1].className).toContain('bg-mak-dark');
  });

  test('removes the toast from the DOM after the timeout', () => {
    Utils.showToast('Bye', 'error');
    const container = document.getElementById('toast-container');
    expect(container.children).toHaveLength(1);

    jest.advanceTimersByTime(3500);
    expect(container.children[0].style.opacity).toBe('0');

    jest.advanceTimersByTime(300);
    expect(container.children).toHaveLength(0);
  });
});

describe('showConfirm', () => {
  test('resolves true when the confirm button is clicked', async () => {
    const promise = Utils.showConfirm('Delete?', 'This cannot be undone.');
    document.querySelector('.confirm-ok').click();
    await expect(promise).resolves.toBe(true);
  });

  test('resolves false when the cancel button is clicked', async () => {
    const promise = Utils.showConfirm('Delete?', 'This cannot be undone.');
    document.querySelector('.confirm-cancel').click();
    await expect(promise).resolves.toBe(false);
  });

  test('sets the title and message text', () => {
    Utils.showConfirm('My Title', 'My message');
    expect(document.querySelector('#confirm-overlay h4').textContent).toBe('My Title');
    expect(document.querySelector('#confirm-overlay p').textContent).toBe('My message');
  });
});

describe('openLightbox', () => {
  test('creates the lightbox, sets the image src, and reveals it', () => {
    Utils.openLightbox('/uploads/screenshot.png');
    const lb = document.getElementById('lightbox');
    expect(lb).not.toBeNull();
    expect(lb.querySelector('img').src).toContain('/uploads/screenshot.png');
    expect(lb.classList.contains('hidden')).toBe(false);
  });

  test('clicking the lightbox hides it again', () => {
    Utils.openLightbox('/uploads/screenshot.png');
    const lb = document.getElementById('lightbox');
    lb.click();
    expect(lb.classList.contains('hidden')).toBe(true);
  });
});
