const embeddingMock = {
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    generateEmbeddings: jest.fn().mockImplementation((texts) => {
        return Promise.resolve(texts.map(() => new Array(1536).fill(0.1)));
    })
};

module.exports = embeddingMock;
