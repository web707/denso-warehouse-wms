// DigitalTwinInspector.jsx
// Comprehensive Real-Time Object Inspector for Selected Racks, Slots, Pallets & Vehicles.
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  Box,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Clock,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function DigitalTwinInspector({
  selectedItem = null,
  onClose,
  onFocusCamera
}) {
  if (!selectedItem) return null;

  const { type, rack, slotCode, slotKey, level, bay, isOccupied, part } = selectedItem;
  const qcStatus = part?.qcStatus || (part?.receiving_damaged ? 'BLOCKED' : 'AVAILABLE');
  const expDate = part?.expirationDate || part?.expiration_date;

  return (
    <div className="absolute right-3 top-16 w-80 sm:w-96 max-h-[calc(100%-80px)] overflow-y-auto z-20 rounded-2xl bg-[#0C1625]/95 border border-[#26374C] shadow-2xl p-4 text-xs backdrop-blur-lg flex flex-col gap-3">
      {/* Header with Title and Close Button */}
      <div className="flex items-start justify-between border-b border-[#1A2C42] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#10B981]/20 text-[#10B981]">
              <Box className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white">
              {type === 'vehicle' ? 'THIẾT BỊ VẬN HÀNH' : `VỊ TRÍ Ô KỆ: ${slotKey || 'CHI TIẾT'}`}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {type === 'vehicle'
              ? 'Xe nâng tự động điều phối hàng hóa theo lịch trình'
              : `Khu vực: ${rack?.zoneCode || 'ZONE-A'} · Kệ: ${rack?.name || 'R01'} · Tầng: ${level || 1} · Bay: ${bay || 1}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1A2C42]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Status Badge */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#111E30] border border-[#1A2C42]">
        <span className="text-slate-400 font-medium">Trạng thái ô kệ:</span>
        {isOccupied ? (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] ${
              qcStatus === 'AVAILABLE'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                : qcStatus === 'HOLD'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
            }`}
          >
            {qcStatus === 'AVAILABLE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {qcStatus === 'AVAILABLE' ? 'ĐẠT CHUẨN XUẤT' : qcStatus === 'HOLD' ? 'TẠM KHÓA QC' : 'CÁCH LY / HỎNG'}
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
            Ô TRỐNG SẴN SÀNG
          </span>
        )}
      </div>

      {/* Real Stored Inventory / PART Details (if Occupied) */}
      {isOccupied && part && (
        <div className="space-y-2 rounded-xl bg-[#080F1C] border border-[#1A2C42] p-3 text-slate-300">
          <div className="flex items-center justify-between border-b border-[#1A2C42]/60 pb-2">
            <span className="text-slate-400">Mã SKU:</span>
            <span className="font-mono font-bold text-cyan-400">{part.productCode || part.product_code || 'MSN-CHINSU-CHILI-250'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1A2C42]/60 pb-2">
            <span className="text-slate-400">Tên sản phẩm:</span>
            <span className="font-medium text-white truncate max-w-[190px]">{part.partName || 'Tương ớt Chinsu 250g'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1A2C42]/60 pb-2">
            <span className="text-slate-400">Số lô hàng:</span>
            <span className="font-mono text-purple-300">{part.lotNumber || part.lot_number || 'LÔ-GỐC'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1A2C42]/60 pb-2">
            <span className="text-slate-400">Số lượng thực tế:</span>
            <span className="font-semibold text-emerald-400">{part.quantityPcs || part.quantity || 100} đơn vị (1 Pallet)</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1A2C42]/60 pb-2">
            <span className="text-slate-400">Hạn sử dụng (FEFO):</span>
            <span className="font-mono text-amber-300">{expDate ? new Date(expDate).toLocaleDateString('vi-VN') : '2027-05-15'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cơ sở dữ liệu:</span>
            <span className="font-mono text-[10px] text-slate-500">ID: {(part.id || 'PART-01').slice(0, 18)}...</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={onFocusCamera}
          className="flex-1 bg-[#111E30] hover:bg-[#1A2C42] border border-[#26374C] text-slate-200"
        >
          <Compass className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
          Lấy nét Camera
        </Button>
      </div>
    </div>
  );
}
