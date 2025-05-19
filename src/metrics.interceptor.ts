// metrics.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly counter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const now = Date.now();
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    const route  = req.route?.path || req.url;

    return next.handle().pipe(
      tap(() => {
        // sukses path
        const duration = (Date.now() - now) / 1000;
        this.counter.inc({ method, route, status: '200' });
        this.histogram.observe({ method, route, status: '200' }, duration);
      }),
      catchError(err => {
        // error path (misal status 500)
        const res = ctx.switchToHttp().getResponse();
        const status = String(res.statusCode || 500);
        const duration = (Date.now() - now) / 1000;
        this.counter.inc({ method, route, status });
        this.histogram.observe({ method, route, status }, duration);
        return throwError(() => err);
      }),
    );
  }
}
