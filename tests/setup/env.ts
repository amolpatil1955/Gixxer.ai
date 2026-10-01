/**
 * Test environment. Unit tests always run against a dedicated database, a
 * throwaway secret and mock AI providers, regardless of what .env.local
 * contains. (Vitest already sets NODE_ENV to "test".)
 */
process.env.APP_URL = "http://localhost:3000";
process.env.AUTH_SECRET = "vitest-only-secret-that-is-at-least-32-characters-long";
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST ?? "mongodb://127.0.0.1:27017/gixxer_test";
process.env.AI_MOCK = "1";

process.env.GROQ_API = "";
process.env.HUGGINGFACE_API_KEY = "";
