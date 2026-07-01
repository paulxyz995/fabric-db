import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import idID from 'antd/locale/id_ID';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import FabricTypes from './pages/FabricTypes';
import Invoices from './pages/Invoices';
import SuratJalan from './pages/SuratJalan';
import Pengguna from './pages/Pengguna';
import Penjualan from './pages/Penjualan';
import Cabang from './pages/Cabang';
import { useAuth } from './hooks/useAuth';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

// Batasi akses berdasarkan peran; kalau tidak berhak, arahkan ke beranda
function RoleRoute({ allow, children }) {
  const auth = useAuth();
  return allow(auth) ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ConfigProvider locale={idID} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="customers"     element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="fabric-types"  element={<FabricTypes />} />
            <Route
              path="branches"
              element={<RoleRoute allow={(a) => a.canWriteOps}><Cabang /></RoleRoute>}
            />
            <Route
              path="invoices"
              element={<RoleRoute allow={(a) => a.isOwner}><Invoices /></RoleRoute>}
            />
            <Route
              path="sales"
              element={<RoleRoute allow={(a) => a.isOwner}><Penjualan /></RoleRoute>}
            />
            <Route path="surat-jalan"   element={<SuratJalan />} />
            <Route
              path="users"
              element={<RoleRoute allow={(a) => a.canManageUsers}><Pengguna /></RoleRoute>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
