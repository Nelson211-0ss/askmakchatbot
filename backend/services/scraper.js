const cheerio = require('cheerio');
const storage = require('./storage');
const { v4: uuidv4 } = require('uuid');

const DOCUMENTS_BUCKET = process.env.MINIO_BUCKET_DOCUMENTS || 'documents';
const DELAY_MS = 1500;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'AskMak/1.0 (Makerere University Support Bot)' },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
}

function cleanHtml($) {
    $('nav, header, footer, script, style, .sidebar, .menu, .breadcrumb, .pagination, iframe, noscript, .social-share, .comments').remove();
}

async function scrapeImages($, baseUrl) {
    const images = [];
    const seen = new Set();

    $('img').each((_, el) => {
        let src = $(el).attr('src');
        if (!src || seen.has(src)) return;
        seen.add(src);

        try {
            const fullUrl = new URL(src, baseUrl).href;
            if (!fullUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) return;
            images.push({
                url: fullUrl,
                alt: $(el).attr('alt') || ''
            });
        } catch {}
    });

    const stored = [];
    for (const img of images.slice(0, 5)) {
        try {
            const response = await fetch(img.url, { signal: AbortSignal.timeout(10000) });
            if (!response.ok) continue;
            const buffer = Buffer.from(await response.arrayBuffer());
            const ext = img.url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'jpg';
            const key = `scraped/${uuidv4()}.${ext}`;
            await storage.uploadFile(DOCUMENTS_BUCKET, key, buffer, `image/${ext}`);
            stored.push(key);
        } catch {}
    }

    return stored;
}

async function scrapeAnswersMak() {
    const articles = [];
    const baseUrl = 'https://answers.mak.ac.ug';

    try {
        console.log('Scraping answers.mak.ac.ug...');
        const html = await fetchPage(baseUrl);
        const $ = cheerio.load(html);

        const links = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && (href.startsWith('/') || href.startsWith(baseUrl))) {
                const fullUrl = new URL(href, baseUrl).href;
                if (fullUrl.startsWith(baseUrl) && !links.includes(fullUrl)) {
                    links.push(fullUrl);
                }
            }
        });

        for (const link of links.slice(0, 100)) {
            try {
                await delay(DELAY_MS);
                const pageHtml = await fetchPage(link);
                const page$ = cheerio.load(pageHtml);
                cleanHtml(page$);

                const title = page$('h1').first().text().trim() || page$('title').text().trim();
                const content = page$('main, article, .content, .entry-content, #content, body')
                    .first().text().replace(/\s+/g, ' ').trim();

                if (!content || content.length < 50) continue;

                const imageKeys = await scrapeImages(page$, link);

                articles.push({
                    title,
                    content: content.substring(0, 10000),
                    source_url: link,
                    category: categorize(title + ' ' + content.substring(0, 500)),
                    image_keys: imageKeys
                });

                console.log(`  Scraped: ${title.substring(0, 60)}`);
            } catch (err) {
                console.warn(`  Failed: ${link} - ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Failed to scrape answers.mak.ac.ug:', err.message);
    }

    return articles;
}

async function scrapeMakMainSite() {
    const articles = [];
    const pages = [
        'https://www.mak.ac.ug',
        'https://www.mak.ac.ug/about-makerere',
        'https://www.mak.ac.ug/admissions',
        'https://www.mak.ac.ug/academics',
        'https://www.mak.ac.ug/student-life',
        'https://www.mak.ac.ug/research',
        'https://www.mak.ac.ug/about-makerere/contact-us',
        'https://www.mak.ac.ug/about-makerere/academic-calendar'
    ];

    for (const url of pages) {
        try {
            await delay(DELAY_MS);
            console.log(`Scraping: ${url}`);
            const html = await fetchPage(url);
            const $ = cheerio.load(html);
            cleanHtml($);

            const title = $('h1').first().text().trim() || $('title').text().trim();
            const content = $('main, article, .content, .region-content, body')
                .first().text().replace(/\s+/g, ' ').trim();

            if (!content || content.length < 50) continue;

            const imageKeys = await scrapeImages($, url);

            articles.push({
                title,
                content: content.substring(0, 10000),
                source_url: url,
                category: categorize(title + ' ' + content.substring(0, 500)),
                image_keys: imageKeys
            });
        } catch (err) {
            console.warn(`Failed: ${url} - ${err.message}`);
        }
    }

    return articles;
}

function categorize(text) {
    const t = text.toLowerCase();
    if (/admission|apply|application|intake|entry/.test(t)) return 'admissions';
    if (/fee|tuition|payment|prn|cost/.test(t)) return 'fees';
    if (/program|course|degree|diploma|bachelor|master|phd/.test(t)) return 'programs';
    if (/exam|assessment|grading|result|transcript|gpa/.test(t)) return 'academic';
    if (/accommodation|hall|residence|hostel/.test(t)) return 'campus';
    if (/library|ict|wifi|email|portal|acmis/.test(t)) return 'IT';
    if (/calendar|semester|deadline|registration/.test(t)) return 'academic';
    if (/scholarship|bursary|sponsorship|financial/.test(t)) return 'fees';
    return 'general';
}

function chunkText(text, maxTokens = 600, overlap = 100) {
    const paragraphs = text.split(/\n{2,}|\.\s+(?=[A-Z])/);
    const chunks = [];
    let current = '';
    let currentLen = 0;

    for (const para of paragraphs) {
        const paraLen = Math.ceil(para.length / 4);

        if (currentLen + paraLen > maxTokens && current) {
            chunks.push(current.trim());
            const words = current.split(/\s+/);
            const overlapWords = words.slice(-Math.ceil(overlap / 4));
            current = overlapWords.join(' ') + ' ' + para;
            currentLen = Math.ceil(current.length / 4);
        } else {
            current += (current ? '\n\n' : '') + para;
            currentLen += paraLen;
        }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

module.exports = { scrapeAnswersMak, scrapeMakMainSite, chunkText, categorize, fetchPage };
