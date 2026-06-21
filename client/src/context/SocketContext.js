import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { currentLocation, user } = useAuth();

  useEffect(() => {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
    const newSocket = io(socketUrl, { autoConnect: true });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Join user-specific room for targeted notifications
  useEffect(() => {
    if (socket && user?.id) {
      socket.emit('join-user', user.id);
    }
  }, [socket, user]);

  // Join/leave location rooms when location changes
  useEffect(() => {
    if (socket && currentLocation) {
      socket.emit('join-location', currentLocation.id);
      return () => {
        socket.emit('leave-location', currentLocation.id);
      };
    }
  }, [socket, currentLocation]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
