import type { Environment } from '../types';

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'BETTER_AUTH_SECRET',
  'AUTH_SERVICE_URL',
  'USER_SERVICE_URL',
] as const;

const findMissingEnvironmentVariables = (env: Partial<Environment>): string[] =>
  REQUIRED_ENVIRONMENT_VARIABLES.filter(key => {
    const value = env[key as keyof Environment];
    return value === undefined || value === null;
  });

const findEmptyEnvironmentVariables = (env: Partial<Environment>): string[] =>
  REQUIRED_ENVIRONMENT_VARIABLES.filter(key => {
    const value = env[key as keyof Environment];
    return typeof value === 'string' && value.trim() === '';
  });

const buildEnvironmentValidationErrors = (
  missingVariables: string[],
  emptyVariables: string[]
): string[] => {
  const errors: string[] = [];
  if (missingVariables.length > 0) {
    errors.push(
      `Missing required environment variables: ${missingVariables.join(', ')}`
    );
  }
  if (emptyVariables.length > 0) {
    errors.push(`Empty environment variables: ${emptyVariables.join(', ')}`);
  }
  return errors;
};

export function validateEnv(env: Partial<Environment>): void {
  const missingVariables = findMissingEnvironmentVariables(env);
  const emptyVariables = findEmptyEnvironmentVariables(env);
  const validationErrors = buildEnvironmentValidationErrors(
    missingVariables,
    emptyVariables
  );

  if (validationErrors.length === 0) return;

  throw new Error(
    `Environment validation failed:\n${validationErrors.join('\n')}\n\n` +
      'Please ensure all required environment variables are set in your .env file or deployment configuration.'
  );
}

export function getEnvironment(env: Environment): 'local' | 'dev' | 'prod' {
  return (env.ENVIRONMENT as 'local' | 'dev' | 'prod') || 'prod';
}

export function isProduction(env: Environment): boolean {
  return getEnvironment(env) === 'prod';
}

export function isDevelopment(env: Environment): boolean {
  const environmentType = getEnvironment(env);
  return environmentType === 'dev' || environmentType === 'local';
}
