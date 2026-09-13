import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/connexion");
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/image/ec2lt-docs.svg" alt="" className="navbar-logo" />
        <span>Projet Collaboratif</span>
      </Link>

      {user && (
        <div className="navbar-user">
          {user.isAdmin && (
            <Link to="/admin" className="btn btn-secondary" title="Administration">
              <ShieldCheck size={16} />
              <span className="navbar-btn-label">Administration</span>
            </Link>
          )}
          <span className="navbar-email">{user.name || user.email}</span>
          <button className="btn btn-secondary" onClick={handleLogout} title="Déconnexion">
            <LogOut size={16} />
            <span className="navbar-btn-label">Déconnexion</span>
          </button>
        </div>
      )}
    </header>
  );
}
