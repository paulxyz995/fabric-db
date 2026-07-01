import { useState } from 'react';
import api from '../utils/api';

export function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  const role = user?.role;
  return {
    user,
    login,
    logout,
    role,
    isOwner: role === 'owner',
    isHr: role === 'hr',
    // Bisa input data operasional (pelanggan, benang, produksi, surat jalan)
    canWriteOps: role === 'owner' || role === 'admin',
    // Bisa kelola user (tambah admin)
    canManageUsers: role === 'owner' || role === 'hr',
    // Alias lama: dipakai tombol tambah/edit/hapus data operasional
    isAdmin: role === 'owner' || role === 'admin',
  };
}
