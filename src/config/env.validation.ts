import * as Joi from 'joi';

/**
 * Environment schema checked at boot, so a missing or malformed variable
 * stops startup instead of failing on the first request that needs it.
 * Only values with a safe, non-secret default are optional.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().min(32).required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  MONGO_URI: Joi.string().uri().required(),
  // Its own toggle rather than derived from NODE_ENV, so it's explicit.
  ENABLE_SWAGGER: Joi.boolean().default(true),
  // Base URL for the Deezer public API behind `Artist.profile`. Defaulted
  // (it's public, needs no key); overridable for tests or a proxy.
  DEEZER_API_URL: Joi.string().uri().default('https://api.deezer.com'),
  // Where uploaded files (avatars) are written, relative to the working
  // directory unless absolute. Overridable so tests can use a temp dir.
  UPLOADS_DIR: Joi.string().default('uploads'),
  // Comma-separated browser origins allowed to call the API. Unset means
  // no CORS headers at all: only same-origin pages (and non-browser
  // clients) can use it.
  CORS_ORIGIN: Joi.string().optional(),
});
