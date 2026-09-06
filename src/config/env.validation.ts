import * as Joi from 'joi';

/**
 * Validated at boot by `ConfigModule.forRoot({ validationSchema: ... })`
 * in `app.module.ts` — a missing or malformed required variable makes the
 * app refuse to start with a clear error, instead of limping along with
 * `undefined` and failing confusingly on the first request that needs it.
 *
 * `PORT`/`DB_PORT` get sensible, non-sensitive defaults (matching this
 * app's previous hardcoded behavior); the rest have no universal default
 * that would be safe to guess, so they're required.
 */
export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().min(32).required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
});
