jest.mock('uuid', () => ({
    v4: () => 'mocked-uuid-1234'
}));

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        status: 'ready',
        on: jest.fn(),
        setex: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        scanStream: jest.fn().mockReturnValue({
            [Symbol.asyncIterator]: async function* () { yield []; }
        })
    }));
});
