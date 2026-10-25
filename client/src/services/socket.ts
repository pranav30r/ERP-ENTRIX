import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Socket.io] Connected to ENTRIX real-time telemetry server');
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected from real-time server');
    });
  }

  return socket;
};
