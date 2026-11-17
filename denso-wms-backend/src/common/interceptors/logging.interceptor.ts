import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, path } = req;
    const start = Date.now();

    res.once('finish', () => {
      const line = `${method} ${path} ${res.statusCode} +${Date.now() - start}ms`;
      if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    return next.handle();
  }
}
