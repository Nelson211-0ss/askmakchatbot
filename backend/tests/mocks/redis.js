const redisMock = {
    client: null,
    setCache: jest.fn().mockResolvedValue(true),
    getCache: jest.fn().mockResolvedValue(null),
    clearKBCache: jest.fn().mockResolvedValue(true)
};

module.exports = redisMock;
