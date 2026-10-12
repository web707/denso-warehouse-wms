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

function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <StoreProvider>
          <Routes>
            {/* Đã bỏ đăng nhập: các đường dẫn cũ đưa thẳng về trang chủ */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="/forgot-password" element={<Navigate to="/" replace />} />
            <Route path="/reset-password" element={<Navigate to="/" replace />} />

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
              <Route path="/locations/:rackId/:slotCode" element={<LocationDetail />} />
              <Route path="/zones" element={<Zones />} />
              <Route path="/reports" element={<Reports />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
          <Toaster />
        </StoreProvider>
      </Router>
    </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
