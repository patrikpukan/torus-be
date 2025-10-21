import { Injectable, Logger } from '@nestjs/common';
import { NextFunction, Request, Response, Router } from 'express';

@Injectable()
export class AuthHttpRouter {
  private readonly logger = new Logger(AuthHttpRouter.name);

  buildRouter(): Router {
    const router = Router();

    router.post(
      '/signup',
      this.createHandler((req) =>
      ),
    );

    router.post(
      '/signin',
      this.createHandler((req) =>
      ),
    );

    router.post(
      '/signout',
    );

    router.post(
      '/password/forgot',
      this.createHandler((req) =>
      ),
    );

    router.post(
      '/password/reset',
      this.createHandler((req) =>
      ),
    );

    router.post(
      '/verify-email',
      this.createHandler((req) =>
      ),
    );

    router.get(
      '/session',
      this.createHandler((req) =>

      ),
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
