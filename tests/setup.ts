// Test setup file
// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_BASE_URL = 'https://test.com';
process.env.LIGHTRAG_WORKING_DIR = '/tmp/test-lightrag';

// Set test timeout
jest.setTimeout(30000);
