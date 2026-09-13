import { useEffect, useRef, useState } from "react";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import "./FilesPanel.css";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function FilesPanel({ documentId, role }) {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const canEdit = role === "owner" || role === "editor";

  async function loadFiles() {
    setLoading(true);
    try {
      const data = await api.listFiles(documentId, token);
      setFiles(data.files);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await api.uploadFile(documentId, file, token);
      await loadFiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(fileId) {
    try {
      const { download_url } = await api.downloadFile(documentId, fileId, token);
      window.open(download_url, "_blank");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(fileId) {
    if (!window.confirm("Supprimer ce fichier ?")) return;
    try {
      await api.deleteFile(documentId, fileId, token);
      setFiles((f) => f.filter((file) => file.id !== fileId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="files-panel">
      {canEdit && (
        <div className="files-upload">
          <input ref={inputRef} type="file" onChange={handleUpload} hidden />
          <button className="btn btn-secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload size={16} />
            {uploading ? "Envoi en cours…" : "Ajouter un fichier"}
          </button>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="centered-loader">Chargement…</div>
      ) : files.length === 0 ? (
        <p className="files-empty">Aucun fichier attaché à ce document.</p>
      ) : (
        <ul className="files-list">
          {files.map((file) => (
            <li key={file.id} className="files-item">
              <Paperclip size={16} className="files-item-icon" />
              <div className="files-item-info">
                <span className="files-item-name">{file.filename}</span>
                <span className="files-item-size">{formatSize(file.size)}</span>
              </div>
              <button className="icon-btn" onClick={() => handleDownload(file.id)} title="Télécharger">
                <Download size={16} />
              </button>
              {canEdit && (
                <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(file.id)} title="Supprimer">
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
