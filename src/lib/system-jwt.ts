import { sign } from 'hono/jwt';

export const generateSystemJWT = async (
  secret: string,
  service: string
): Promise<string> => {
  return await sign(
    {
      sub: 'system',
      type: 'system',
      service,
      exp: Math.floor(Date.now() / 1000) + 86400, // 24hr
    },
    secret
  );
};

export const createSystemHeaders = async (
  secret: string,
  service: string
): Promise<Record<string, string>> => {
  const token = await generateSystemJWT(secret, service);
  return {
    'X-System-Token': 'true',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};
