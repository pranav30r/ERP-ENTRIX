import { Router, Request, Response } from 'express';
import net from 'net';
import axios from 'axios';
import { sequelize } from '../config/db';

const router = Router();

let isShuttingDown = false;

export const setShuttingDown = (value: boolean): void => {
  isShuttingDown = value;
};

// Check Redis connectivity via raw TCP ping with 1.5s timeout
const checkRedis = async (host: string, port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);

    socket.connect(port, host, () => {
      socket.write('PING\r\n');
    });

    socket.on('data', (data) => {
      socket.destroy();
      resolve(data.toString().includes('PONG'));
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

// Check AI microservice health with 1.5s timeout
const checkAiService = async (url: string): Promise<boolean> => {
  try {
    const res = await axios.get(`${url}/docs`, { timeout: 1500 });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
};

/**
 * Liveness Probe: Indicates whether the Node.js application process is alive.
 * Fails only if the process is completely hung or unresponsive.
 */
router.get(['/health', '/health/live', '/live'], (_req: Request, res: Response): void => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'SHUTTING_DOWN',
      message: 'Server is terminating active connections.'
    });
    return;
  }

  res.status(200).json({
    status: 'ONLINE',
    system: 'ENTRIX ERP Backend',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness Probe: Indicates whether the application is ready to accept production traffic.
 * Validates critical dependencies (PostgreSQL) and reports degraded state for optional services.
 * Never exposes credentials, hosts, ports, or internal topology.
 */
router.get(['/ready', '/health/ready'], async (_req: Request, res: Response): Promise<void> => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'NOT_READY',
      reason: 'Server is in graceful shutdown phase.'
    });
    return;
  }

  const checks: Record<string, 'UP' | 'DOWN' | 'SKIPPED'> = {
    database: 'DOWN',
    redis: 'SKIPPED',
    ai_service: 'SKIPPED'
  };

  let criticalFailure = false;

  // 1. Critical: Database Connectivity Check
  try {
    await sequelize.authenticate();
    checks.database = 'UP';
  } catch {
    checks.database = 'DOWN';
    criticalFailure = true;
  }

  // 2. Non-Critical: Redis Check (if configured)
  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT || '6380', 10);
  if (redisHost) {
    const redisOk = await checkRedis(redisHost, redisPort);
    checks.redis = redisOk ? 'UP' : 'DOWN';
  }

  // 3. Non-Critical: AI Service Check (if configured)
  const aiUrl = process.env.AI_SERVICE_URL;
  if (aiUrl) {
    const aiOk = await checkAiService(aiUrl);
    checks.ai_service = aiOk ? 'UP' : 'DOWN';
  }

  if (criticalFailure) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      checks,
      message: 'Critical dependencies unavailable. Application cannot serve traffic.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const isDegraded = checks.redis === 'DOWN' || checks.ai_service === 'DOWN';

  res.status(200).json({
    status: isDegraded ? 'DEGRADED' : 'READY',
    checks,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;
