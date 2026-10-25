import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RequestWithContext extends Request {
  id?: string;
  startTime?: number;
}

export const requestContextMiddleware = (req: RequestWithContext, res: Response, next: NextFunction): void => {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = typeof incomingId === 'string' && incomingId.trim().length > 0
    ? incomingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', requestId);

  // Structured response logging on completion
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const sanitizedPath = req.baseUrl + req.path;
    const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

    // Structured JSON log output in production, readable line in development
    if (process.env.NODE_ENV === 'production') {
      const logEntry = JSON.stringify({
        level: logLevel,
        timestamp: new Date().toISOString(),
        req_id: requestId,
        method: req.method,
        path: sanitizedPath,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.ip || req.socket.remoteAddress
      });
      if (res.statusCode >= 500) {
        console.error(logEntry);
      } else {
        console.log(logEntry);
      }
    } else {
      console.log(`[HTTP] ${req.method} ${sanitizedPath} ${res.statusCode} in ${duration}ms [id: ${requestId.substring(0, 8)}]`);
    }
  });

  next();
};
