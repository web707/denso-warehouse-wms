import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from '@/lib/theme';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import { StoreProvider } from '@/lib/store';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Racks from '@/pages/Racks';
import RackAllocation from '@/pages/RackAllocation';
import RackPlan from '@/pages/RackPlan';
import PackingRules from '@/pages/PackingRules';
import History from '@/pages/History';
import InventoryOperations from '@/pages/InventoryOperations';
import QRLabels from '@/pages/QRLabels';
import LocationDetail from '@/pages/LocationDetail';
import Zones from '@/pages/Zones';
import Reports from '@/pages/Reports';
import WorkOrders from '@/pages/WorkOrders';
import Inspections from '@/pages/Inspections';
import Shipments from '@/pages/Shipments';
import Traceability from '@/pages/Traceability';
import FEFO from '@/pages/FEFO';
import Catalog from '@/pages/Catalog';
import UserManagement from '@/pages/UserManagement';
import Login from '@/pages/Login';
import { AuthProvider, useAuth } from '@/lib/auth';

function AdminOnly({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

function ProtectedApp() {
  const { signedIn, checking } = useAuth();
  if (checking) return <div className="min-h-screen grid place-items-center text-slate-500">Đang kiểm tra phiên đăng nhập...</div>;
  if (!signedIn) return <Navigate to="/login" replace />;
  return <StoreProvider><Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/orders/:orderId" element={<OrderDetail />} />
      <Route path="/racks" element={<Racks />} />
      <Route path="/racks/:orderId" element={<RackAllocation />} />
      <Route path="/racks/:rackId/plan" element={<RackPlan />} />
      <Route path="/history" element={<History />} />
      <Route path="/packing-rules" element={<PackingRules />} />
      <Route path="/inventory" element={<InventoryOperations />} />
      <Route path="/qr-labels" element={<QRLabels />} />
      <Route path="/work-orders" element={<WorkOrders />} />
      <Route path="/inspections" element={<Inspections />} />
      <Route path="/shipments" element={<Shipments />} />
      <Route path="/trace" element={<Traceability />} />
      <Route path="/fefo" element={<FEFO />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/users" element={<AdminOnly><UserManagement /></AdminOnly>} />
      <Route path="/locations/:rackId/:slotCode" element={<LocationDetail />} />
      <Route path="/zones" element={<Zones />} />
      <Route path="/reports" element={<Reports />} />
    </Route><Route path="*" element={<PageNotFound />} />
  </Routes></StoreProvider>;
}

function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </AuthProvider>
        <Toaster />
      </Router>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
