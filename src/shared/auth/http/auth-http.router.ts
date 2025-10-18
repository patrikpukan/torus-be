import { Injectable, Logger } from '@nestjs/common';
import { NextFunction, Request, Response, Router } from 'express';
import {
  AuthHandlerResult,
  AuthService,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  SignInPayload,
  SignUpPayload,
  VerifyEmailPayload,
} from '../services/auth.service';

@Injectable()
export class AuthHttpRouter {
  private readonly logger = new Logger(AuthHttpRouter.name);

  constructor(private readonly authService: AuthService) {}

  buildRouter(): Router {
    const router = Router();

    router.post(
      '/signup',
      this.createHandler((req) =>
        this.authService.signUp(req, req.body as SignUpPayload),
      ),
    );

    router.post(
      '/signin',
      this.createHandler((req) =>
        this.authService.signIn(req, req.body as SignInPayload),
      ),
    );

    router.post(
      '/signout',
      this.createHandler((req) => this.authService.signOut(req)),
    );

    router.post(
      '/password/forgot',
      this.createHandler((req) =>
        this.authService.forgotPassword(req, req.body as ForgotPasswordPayload),
      ),
    );

    router.post(
      '/password/reset',
      this.createHandler((req) =>
        this.authService.resetPassword(req, req.body as ResetPasswordPayload),
      ),
    );

    router.post(
      '/verify-email',
      this.createHandler((req) =>
        this.authService.verifyEmail(req, req.body as VerifyEmailPayload),
      ),
    );

    router.get(
      '/session',
      this.createHandler((req) => this.authService.currentSession(req)),
    );

    return router;
  }

  private createHandler<T>(
    handler: (req: Request) => Promise<AuthHandlerResult<T>>,
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await handler(req);
        this.applyHeaders(res, result.headers);
        res.status(result.statusCode).json(result.body);
      } catch (error) {
        this.logger.error(
          `Auth route failed for ${req.method} ${req.path}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        next(error);
      }
    };
  }

  private applyHeaders(res: Response, headers?: Headers | null): void {
    if (!headers) {
      return;
    }

    headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        res.append('Set-Cookie', value);
      } else {
        res.setHeader(key, value);
      }
    });
  }
}
