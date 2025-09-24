const { MinioStorage } = require('../storage/MinioStorage');

jest.mock('minio');

describe('MinioStorage', () => {
    let storage;
    let mockClient;

    beforeEach(() => {
        mockClient = {
            bucketExists: jest.fn(),
            makeBucket: jest.fn(),
            getObject: jest.fn(),
            putObject: jest.fn(),
            removeObject: jest.fn()
        };

        const { Client } = require('minio');
        Client.mockImplementation(() => mockClient);

        storage = new MinioStorage({
            endPoint: 'localhost',
            port: 9000,
            useSSL: false,
            accessKey: 'test',
            secretKey: 'test'
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        test('should create bucket if it does not exist', async () => {
            mockClient.bucketExists.mockResolvedValue(false);
            mockClient.makeBucket.mockResolvedValue();

            await storage.ensureBucket();

            expect(mockClient.bucketExists).toHaveBeenCalledWith('mordecai-documents');
            expect(mockClient.makeBucket).toHaveBeenCalledWith('mordecai-documents');
        });

        test('should not create bucket if it exists', async () => {
            mockClient.bucketExists.mockResolvedValue(true);

            await storage.ensureBucket();

            expect(mockClient.bucketExists).toHaveBeenCalledWith('mordecai-documents');
            expect(mockClient.makeBucket).not.toHaveBeenCalled();
        });
    });

    describe('getObject', () => {
        test('should retrieve object from storage', async () => {
            const mockStream = Buffer.from('test content');
            mockClient.getObject.mockResolvedValue(mockStream);

            const result = await storage.getObject('test-key');

            expect(mockClient.getObject).toHaveBeenCalledWith('mordecai-documents', 'test-key');
            expect(result).toEqual(mockStream);
        });

        test('should handle retrieval errors', async () => {
            mockClient.getObject.mockRejectedValue(new Error('Object not found'));

            await expect(storage.getObject('invalid-key')).rejects.toThrow('Object not found');
        });
    });

    describe('putObject', () => {
        test('should store object successfully', async () => {
            const testBuffer = Buffer.from('test content');
            mockClient.putObject.mockResolvedValue({ etag: 'test-etag' });

            const result = await storage.putObject('test-key', testBuffer, 'application/pdf');

            expect(mockClient.putObject).toHaveBeenCalledWith(
                'mordecai-documents',
                'test-key',
                testBuffer,
                testBuffer.length,
                { 'Content-Type': 'application/pdf' }
            );
            expect(result).toEqual({ etag: 'test-etag' });
        });
    });

    describe('removeObject', () => {
        test('should delete object successfully', async () => {
            mockClient.removeObject.mockResolvedValue();

            await storage.removeObject('test-key');

            expect(mockClient.removeObject).toHaveBeenCalledWith('mordecai-documents', 'test-key');
        });
    });
});