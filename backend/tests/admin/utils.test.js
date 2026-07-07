const dbMock = require('../mocks/db');
const embeddingMock = require('../mocks/embedding');

jest.mock('../../config/db', () => require('../mocks/db'));
jest.mock('../../services/embedding', () => require('../mocks/embedding'));
jest.mock('../../services/scraper', () => ({
    chunkText: jest.fn().mockReturnValue([
        'First chunk text here with many words so it passes the word count filter successfully.',
        'Second chunk text here with many words so it passes the word count filter successfully.'
    ])
}));

const utils = require('../../routes/admin/utils');

describe('Admin Route Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('wordCountKb', () => {
        it('should count words correctly', () => {
            expect(utils.wordCountKb('hello world')).toBe(2);
            expect(utils.wordCountKb('  multiple   spaces  ')).toBe(2);
            expect(utils.wordCountKb('')).toBe(0);
            expect(utils.wordCountKb(null)).toBe(0);
        });
    });

    describe('kbEntryDocumentSourceUrl', () => {
        it('should format URL correctly', () => {
            expect(utils.kbEntryDocumentSourceUrl(' 123-abc ')).toBe('kb-entry://123-abc');
        });
    });

    describe('removeKbSyncedDocuments', () => {
        it('should execute delete query', async () => {
            dbMock.query.mockResolvedValue({ rowCount: 1 });
            await utils.removeKbSyncedDocuments('123');
            expect(dbMock.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM documents WHERE source_url = $1'),
                ['kb-entry://123']
            );
        });
    });

    describe('syncKbEntryDocuments', () => {
        it('should clear synced documents if entry is not published', async () => {
            const entry = { id: '123', is_published: false };
            dbMock.query.mockResolvedValue({ rowCount: 1 });
            const result = await utils.syncKbEntryDocuments(entry);
            expect(result).toEqual({ ok: true, chunks: 0, mode: 'cleared_draft' });
            expect(dbMock.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM documents WHERE source_url = $1'),
                ['kb-entry://123']
            );
        });

        it('should return error if title or content is missing', async () => {
            const entry = { id: '123', is_published: true, category: 'faq', title: '', content: 'hello' };
            const result = await utils.syncKbEntryDocuments(entry);
            expect(result).toEqual({ ok: false, chunks: 0, error: 'missing_title_or_content' });
        });

        it('should sync successfully when valid', async () => {
            const entry = { id: '123', is_published: true, category: 'faq', title: 'My Title', content: 'Some body content here.' };
            dbMock.query.mockResolvedValue({ rowCount: 1 });
            
            const result = await utils.syncKbEntryDocuments(entry);
            expect(result.ok).toBe(true);
            expect(result.chunks).toBe(2);
            expect(result.mode).toBe('indexed');
            expect(embeddingMock.generateEmbeddings).toHaveBeenCalled();
            expect(dbMock.query).toHaveBeenCalledTimes(3); // 1 delete + 2 inserts
        });
    });
});
