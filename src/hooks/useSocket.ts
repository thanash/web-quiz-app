import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(): Socket {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io({
      path: '/web-quiz-app/socket.io',
      transports: ['websocket', 'polling'],
    });
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef.current;
}
