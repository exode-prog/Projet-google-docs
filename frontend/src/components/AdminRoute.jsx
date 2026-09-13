import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/connexion" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}
