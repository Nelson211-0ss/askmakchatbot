const cheerio = require('cheerio');
const { isMakerereHostname } = require('../scraper');

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'AskMak/1.0 (Makerere University Support Bot)' },
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Failed to fetch: ' + response.status);
    return response.text();
}

function extractContent(html) {
    const $ = cheerio.load(html);
    $('nav, header, footer, script, style, .sidebar, .menu, .breadcrumb, .pagination, iframe, noscript').remove();
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const content = $('main, article, .content, .entry-content, #content, .post-content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000);
    return { title, content };
}

function register(reg) {
    reg('fetch_mak_page', {
        description: 'Fetch a *.mak.ac.ug page only when it directly helps a Makerere end-user support answer (portals, ICT, fees, registration, official contacts). Do not use for general browsing or off-topic questions.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Full URL of the page (must be a mak.ac.ug domain)' }
            },
            required: ['url']
        }
    }, async (args) => {
        let parsed;
        try {
            parsed = new URL(args.url);
        } catch {
            return { error: 'Invalid URL' };
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { error: 'Only http(s) URLs are allowed' };
        }
        if (!isMakerereHostname(parsed.hostname)) {
            return { error: 'Only *.mak.ac.ug domains are allowed' };
        }
        const html = await fetchPage(parsed.href);
        const { title, content } = extractContent(html);
        return { title, content, url: parsed.href, fetched_at: new Date().toISOString() };
    });

    reg('get_upcoming_events', {
        description: 'List upcoming Makerere events from the website. Use only if the user’s question is genuinely about Makerere and events—not general chat.',
        parameters: { type: 'object', properties: {} }
    }, async () => {
        try {
            const html = await fetchPage('https://www.mak.ac.ug/events');
            const $ = cheerio.load(html);
            const events = [];

            $('article, .event-item, .views-row').each((_, el) => {
                const title = $(el).find('h2, h3, .event-title, .field-title').first().text().trim();
                const date = $(el).find('.date, .event-date, time, .field-date').first().text().trim();
                const link = $(el).find('a').first().attr('href');
                if (title) {
                    events.push({
                        title,
                        date: date || 'TBD',
                        url: link ? new URL(link, 'https://www.mak.ac.ug').href : null
                    });
                }
            });

            return { events: events.slice(0, 10) };
        } catch {
            return { events: [], note: 'Could not fetch events at this time' };
        }
    });

    reg('get_latest_news', {
        description: 'Get recent news snippets from mak.ac.ug. Use only if relevant to Makerere end-user support; do not use for unrelated or general knowledge questions.',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'integer', description: 'Number of news items (default 5)' }
            }
        }
    }, async (args) => {
        try {
            const html = await fetchPage('https://www.mak.ac.ug');
            const $ = cheerio.load(html);
            const news = [];

            $('article, .news-item, .views-row').each((_, el) => {
                const title = $(el).find('h2, h3, .news-title').first().text().trim();
                const summary = $(el).find('p, .summary, .field-body').first().text().trim();
                const link = $(el).find('a').first().attr('href');
                if (title) {
                    news.push({
                        title,
                        summary: summary.substring(0, 200),
                        url: link ? new URL(link, 'https://www.mak.ac.ug').href : null
                    });
                }
            });

            return { news: news.slice(0, args.limit || 5) };
        } catch {
            return { news: [], note: 'Could not fetch news at this time' };
        }
    });

    reg('check_academic_calendar', {
        description: 'Fetch academic calendar dates from mak.ac.ug. Use only for Makerere support questions about term dates, registration or exam periods—not general conversation.',
        parameters: { type: 'object', properties: {} }
    }, async () => {
        try {
            const html = await fetchPage('https://www.mak.ac.ug/about-makerere/academic-calendar');
            const { content } = extractContent(html);
            return {
                content: content.substring(0, 3000),
                note: 'This is the latest academic calendar information from the Makerere University website.'
            };
        } catch {
            return { note: 'Could not fetch the academic calendar. Please check https://www.mak.ac.ug for the latest information.' };
        }
    });
}

module.exports = { register };
