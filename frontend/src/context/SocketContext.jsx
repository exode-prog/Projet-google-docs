import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://localhost:3443";

// Une seule connexion Socket.io pour toute l'application, ouverte dès qu'un
// utilisateur est authentifié et fermée à la déconnexion. Les pages (chat,
// appel) s'y abonnent via useSocket() plutôt que d'ouvrir chacune leur propre
// connexion.
export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = io(SOCKET_URL, { auth: { token } });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket doit être utilisé à l'intérieur de <SocketProvider>");
  return ctx;
}
