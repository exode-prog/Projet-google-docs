const API_URL = import.meta.env.VITE_API_URL || "https://localhost:3443";

// Point d'entrée unique pour tous les appels à l'API REST du backend.
// Centralise l'ajout du token JWT et la gestion des réponses d'erreur.
async function request(path, { method = "GET", body, token, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Erreur ${response.status}`);
  }
  return data;
}

export const api = {
  register: (email, password, name) => request("/api/auth/register", { method: "POST", body: { email, password, name } }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),

  listDocuments: (token) => request("/api/documents", { token }),
  createDocument: (title, token) => request("/api/documents", { method: "POST", body: { title }, token }),
  getDocument: (id, token) => request(`/api/documents/${id}`, { token }),
  renameDocument: (id, title, token) => request(`/api/documents/${id}`, { method: "PATCH", body: { title }, token }),
  deleteDocument: (id, token) => request(`/api/documents/${id}`, { method: "DELETE", token }),

  listMessages: (documentId, token) => request(`/api/documents/${documentId}/messages`, { token }),

  adminListUsers: (token) => request("/api/admin/users", { token }),
  adminCreateUser: (data, token) => request("/api/admin/users", { method: "POST", body: data, token }),
  adminUserDocuments: (userId, token) => request(`/api/admin/users/${userId}/documents`, { token }),
  adminStats: (token) => request("/api/admin/stats", { token }),
  adminUpdateUser: (userId, updates, token) => request(`/api/admin/users/${userId}`, { method: "PATCH", body: updates, token }),
  adminDeleteUser: (userId, token) => request(`/api/admin/users/${userId}`, { method: "DELETE", token }),

  listPermissions: (documentId, token) => request(`/api/documents/${documentId}/permissions`, { token }),
  inviteToDocument: (documentId, email, role, token) =>
    request(`/api/documents/${documentId}/invite`, { method: "POST", body: { email, role }, token }),

  listFiles: (documentId, token) => request(`/api/documents/${documentId}/files`, { token }),
  uploadFile: (documentId, file, token) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/documents/${documentId}/files`, { method: "POST", body: formData, token, isFormData: true });
  },
  downloadFile: (documentId, fileId, token) =>
    request(`/api/documents/${documentId}/files/${fileId}/download`, { token }),
  deleteFile: (documentId, fileId, token) =>
    request(`/api/documents/${documentId}/files/${fileId}`, { method: "DELETE", token }),
};

export { API_URL };
