import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import procurementRoutes from './routes/procurementRoutes';
import projectRoutes from './routes/projectRoutes';
import auditRoutes from './routes/auditRoutes';
import financeRoutes from './routes/financeRoutes';
import hrRoutes from './routes/hrRoutes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow any origin in local development (localhost & 127.0.0.1)
  credentials: true
}));
app.use(express.json());

// Pass Socket.io to request object
app.use((req: any, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/procurement', procurementRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/hr', hrRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'ENTRIX ERP Backend',
    timestamp: new Date().toISOString()
  });
});

// Socket connection
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

export const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[Server] ENTRIX Backend listening on port ${PORT}`);
    console.log(`[Server] Healthcheck: http://localhost:${PORT}/health`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server, io };
