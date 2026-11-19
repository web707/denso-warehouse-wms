// SupplyChain3D.jsx
// MASAN CONSUMER WMS · OPERATIONAL 3D WAREHOUSE DIGITAL TWIN (HÀNH TRÌNH CHUỖI CUNG ỨNG 3D)
// Giao diện Digital Twin vận hành kho cao cấp, kết nối dữ liệu thực tế và mô phỏng sự kiện nghiệp vụ.
import React from 'react';
import OperationalDigitalTwin from '@/components/digital-twin/OperationalDigitalTwin';
import { Layers, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SupplyChain3D() {
  return (
    <main className="mx-auto max-w-[1720px] space-y-4 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A2C42] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Hành trình Chuỗi cung ứng 3D · Operational Digital Twin
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Mô phỏng không gian số hóa kho Masan: Tái hiện quy trình Nhập hàng, Soạn hàng FEFO, Điều chuyển nội bộ & Xe nâng tự động theo dữ liệu WMS thực tế.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2">
          <Link
            to="/racks"
            className="px-3 py-1.5 rounded-lg bg-[#111E30] hover:bg-[#1A2C42] border border-[#26374C] text-xs font-medium text-slate-200 transition-colors inline-flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Trung tâm Điều hành Kho 3D (/racks) →
          </Link>
        </div>
      </div>

      {/* Main Operational Digital Twin Workspace */}
      <OperationalDigitalTwin />
    </main>
  );
}
