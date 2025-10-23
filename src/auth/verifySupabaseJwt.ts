import { JwtPayload, verify } from 'jsonwebtoken';

export interface SupabaseJwtClaims extends JwtPayload {
  sub: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
}

export function verifySupabaseJwt(token: string, secret: string): SupabaseJwtClaims {
  const decoded = verify(token, secret, {
    algorithms: ['HS256'],
  });

  if (typeof decoded === 'string') {
    throw new Error('Invalid Supabase JWT payload');
  }

  if (!decoded.sub) {
    throw new Error('Supabase JWT payload missing subject');
  }

  return decoded as SupabaseJwtClaims;
}
