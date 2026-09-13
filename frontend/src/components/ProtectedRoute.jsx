import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Redirige vers la page de connexion si aucun utilisateur n'est authentifié.
// Utilisé pour envelopper toutes les routes qui nécessitent d'être connecté.
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/connexion" replace />;
  return children;
}
