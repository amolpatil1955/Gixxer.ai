import "server-only";
import { z } from "zod";

/** Empty strings in .env files mean "not configured". */
const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalFlag = z
  .string()
  .trim()
  .optional()
  .transform((value) => value === "1" || value === "true");

const withDefault = (fallback: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => value || fallback);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url("APP_URL must be an absolute URL, e.g. http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://")
    .regex(/^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/, "MONGODB_URI must include a database name, e.g. .../gixxer?..."),
  AUTH_GOOGLE_ID: optionalSecret,
  AUTH_GOOGLE_SECRET: optionalSecret,
  /** Text, reasoning and speech-to-text all run on Groq. */
  GROQ_API: optionalSecret,
  /** Images and embeddings run on Hugging Face inference providers. */
  HUGGINGFACE_API_KEY: optionalSecret,
  /** Model overrides. The defaults are the ones verified against the live APIs. */
  GROQ_MODEL: withDefault("qwen/qwen3.8-27b"),
  GROQ_THINK_MODEL: withDefault("openai/gpt-oss-120b"),
  GROQ_FALLBACK_MODEL: withDefault("openai/gpt-oss-20b"),
  GROQ_TRANSCRIBE_MODEL: withDefault("whisper-large-v3-turbo"),
  HF_IMAGE_MODEL: withDefault("black-forest-labs/FLUX.1-schnell"),
  HF_EMBEDDING_MODEL: withDefault("sentence-transformers/all-MiniLM-L6-v2"),
  /**
   * Unsplash, for reference-photo search only (never for generation). The access key is the
   * only one the server sends; the secret and application id are kept for completeness and
   * never leave this process.
   */
  UNSPLASH_APPLICATION_ID: optionalSecret,
  UNSPLASH_ACCESS_KEY: optionalSecret,
  UNSPLASH_SECRET_KEY: optionalSecret,
  /** Shared secret an external scheduler sends to POST /api/cron. Unset means the route is closed. */
  CRON_SECRET: optionalSecret,
  /**
   * Replaces every provider with a deterministic local stand-in. Used by the
   * automated test suites so they never spend money or depend on the network.
   * Never set this in production.
   */
  AI_MOCK: optionalFlag,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Evaluated lazily so that importing a module
 * never crashes a build; the first real use surfaces a precise error instead.
 * Never import this from client components.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
