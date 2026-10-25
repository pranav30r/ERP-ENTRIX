import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB, sequelize } from './config/db';
import authRoutes from './routes/authRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import procurementRoutes from './routes/procurementRoutes';
import projectRoutes from './routes/projectRoutes';
import auditRoutes from './routes/auditRoutes';
import financeRoutes from './routes/financeRoutes';
import hrRoutes from './routes/hrRoutes';
import aiRoutes from './routes/aiRoutes';
import tenantRoutes from './routes/tenantRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import companyRoutes from './routes/companyRoutes';
import healthRoutes, { setShuttingDown } from './routes/healthRoutes';
import { requestContextMiddleware } from './middlewares/requestContext';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env';
import { apiLimiter } from './middlewares/rateLimiter';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const server = http.createServer(app);

// Enable reverse proxy trust for correct client IP detection behind Nginx / ALB
app.set('trust proxy', 1);

// Attach Request ID and structured request duration logging
app.use(requestContextMiddleware);

// 1. Strict Helmet & Content Security Policy configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...ENV.ALLOWED_ORIGINS, 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. Consistent HTTP & Socket.IO CORS configuration using explicit allowlist
const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow legitimate non-browser clients (cURL, native apps, server-to-server) without Origin header
  if (!origin) return true;
  return ENV.ALLOWED_ORIGINS.includes(origin);
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: Origin '${origin}' is not permitted.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// 3. Socket.io with matching CORS allowlist
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: Socket.io origin '${origin}' is not permitted.`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 4. Request parsing and boundary size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api/v1', apiLimiter);

// Pass Socket.io to request object
app.use((req: any, _res, next) => {
  req.io = io;
  next();
});

// 5. API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/procurement', procurementRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/company', companyRoutes);

// 5. System Health & Readiness Routes
app.use('/', healthRoutes);

// Socket.io middleware for JWT authentication & tenant room association
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(String(token), ENV.JWT_SECRET) as any;
    (socket as any).user = decoded;
    (socket as any).tenantId = decoded.tenant_id;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Socket connection
io.on('connection', (socket) => {
  const tenantId = (socket as any).tenantId;
  if (tenantId) {
    socket.join(`tenant:${tenantId}`);
  }
  socket.on('disconnect', () => {
    // client disconnected
  });
});

// 6. Centralized Error Handler - Never leak stack traces, SQL syntax, or internal secrets
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err.message === 'string' && err.message.startsWith('CORS blocked')) {
    res.status(403).json({ success: false, error: err.message });
    return;
  }

  // Non-sensitive operational error logging
  console.error('[Application Error]', err?.name || 'Error', err?.message || 'Unknown error');

  const isProd = ENV.NODE_ENV === 'production';
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;

  res.status(status).json({
    success: false,
    error: isProd ? 'Internal server error occurred. Please contact system support.' : (err?.message || 'Internal server error.')
  });
});

const PORT = ENV.PORT || 5000;

export const startServer = async () => {
  await connectDB();
  return server.listen(PORT, () => {
    console.log(`[Server] ENTRIX Backend listening on port ${PORT}`);
    console.log(`[Server] Liveness Probe:  http://localhost:${PORT}/health`);
    console.log(`[Server] Readiness Probe: http://localhost:${PORT}/ready`);
  });
};

// Graceful Termination Handler (SIGTERM / SIGINT)
export const setupGracefulShutdown = (activeServer: http.Server) => {
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] Received ${signal}. Initiating graceful termination sequence...`);
    setShuttingDown(true);

    // Stop accepting new connections
    activeServer.close(async () => {
      console.log('[Shutdown] HTTP & WebSocket listeners closed.');
      try {
        await sequelize.close();
        console.log('[Shutdown] Database connection pool closed successfully.');
      } catch (err) {
        console.error('[Shutdown Error] Failed to close database cleanly:', err);
      }
      process.exit(0);
    });

    // Force terminate if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Shutdown Error] Graceful shutdown timeout exceeded (10s). Forcing termination.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (process.env.NODE_ENV !== 'test') {
  startServer().then((s) => setupGracefulShutdown(s));
}

export { app, server, io };
