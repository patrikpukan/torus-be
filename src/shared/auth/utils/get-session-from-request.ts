import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import { BetterAuth } from '../providers/better-auth.provider';

export const getSessionFromRequest = async (
  req: Request,
  betterAuth: BetterAuth,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  return betterAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
};
