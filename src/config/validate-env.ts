import type { Environment } from '../types';

/**
 * Required environment variables for organization service
 */
const REQUIRED_ENV_VARS = [
  'BETTER_AUTH_SECRET',
  'AUTH_SERVICE_URL',
  'USER_SERVICE_URL',
] as const;

export function validateEnv(env: Partial<Environment>): void {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = env[key as keyof Environment];

    if (value === undefined || value === null) {
      missing.push(key);
    } else if (typeof value === 'string' && value.trim() === '') {
      empty.push(key);
    }
  }

  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (empty.length > 0) {
    errors.push(`Empty environment variables: ${empty.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
        'Please ensure all required environment variables are set in your .env file or deployment configuration.'
    );
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironment(env: Environment): 'local' | 'dev' | 'prod' {
  return (env.ENVIRONMENT as 'local' | 'dev' | 'prod') || 'prod';
}

/**
 * Check if running in production
 */
export function isProduction(env: Environment): boolean {
  return getEnvironment(env) === 'prod';
}

/**
 * Check if running in development
 */
export function isDevelopment(env: Environment): boolean {
  const envType = getEnvironment(env);
  return envType === 'dev' || envType === 'local';
}
