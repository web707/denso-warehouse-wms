// DigitalTwinHUD.jsx
// Control Toolbar for Digital Twin: Modes, Warehouse Layers, Camera Controls, Fullscreen & Vertical Slice Trigger.
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Play,
  RotateCcw,
  Maximize2,
  Layers,
  Activity,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Truck,
  Sparkles
} from 'lucide-react';

export default function DigitalTwinHUD({
  mode = 'LIVE', // 'LIVE', 'REPLAY', 'SANDBOX'
  onChangeMode,
  activeLayer = 'qc',
  onChangeLayer,
  cameraMode = 'overview',
  onChangeCamera,
  selectedZone = 'ZONE-A',
  onChangeZone,
  onResetCamera,
  onToggleFullscreen,
  onTriggerVerticalSlice,
  isExecutingSlice = false,
  lastSyncTime = null
}) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#0C1625]/90 border-b border-[#1A2C42] backdrop-blur-md">
      {/* Top Row: Mode Switcher & Real-time Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#080F1C] border border-[#1A2C42]">
          <button
            onClick={() => onChangeMode('LIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              mode === 'LIVE'
                ? 'bg-[#10B981] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            VẬN HÀNH TRỰC TUYẾN (LIVE)
          </button>

          <button
            onClick={() => onChangeMode('REPLAY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              mode === 'REPLAY'
                ? 'bg-[#8B5CF6] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-300" />
            TÁI HIỆN LỊCH SỬ (REPLAY)
          </button>

          <button
            onClick={() => onChangeMode('SANDBOX')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              mode === 'SANDBOX'
                ? 'bg-[#F59E0B] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-950" />
            THỬ NGHIỆM SANDBOX (QA)
          </button>
        </div>

        {/* Backend Source of Truth & Live Telemetry Disclaimer */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#111E30] border border-[#26374C] text-[#38BDF8]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
            Hệ thống WMS Máy chủ Trung tâm · Đồng bộ thời gian thực · {lastSyncTime ? `Cập nhật: ${lastSyncTime}` : 'Đồng bộ tức thời'}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-950/40 border border-amber-600/40 text-amber-300 text-[11px]">
            ⚠️ Mô phỏng tuyến nội bộ · Không đọc GPS phần cứng
          </span>
        </div>
      </div>

      {/* Bottom Row: Layers, Camera Controls, Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1A2C42]/60 text-xs">
        {/* Layer Filters */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Lớp hiển thị:
          </span>
          {[
            { id: 'qc', label: 'Trạng thái QC' },
            { id: 'sku', label: 'Mã SKU' },
            { id: 'expiry', label: 'Hạn dùng FEFO' },
            { id: 'normal', label: 'Thực tế' }
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => onChangeLayer(l.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                activeLayer === l.id
                  ? 'bg-[#10B981]/20 border border-[#10B981] text-[#10B981] font-medium'
                  : 'bg-[#111E30] border border-[#1A2C42] text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Camera Views & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Vertical Slice One-Click Trigger Button */}
          <Button
            size="sm"
            onClick={onTriggerVerticalSlice}
            disabled={isExecutingSlice}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md border-0"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-200" />
            {isExecutingSlice ? 'Đang thực thi chu trình mẫu...' : 'Chạy chu trình Nhập → Kệ mẫu'}
          </Button>

          {/* Camera Dropdown */}
          <label className="flex items-center gap-1 text-slate-300 font-medium">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Camera:
            <select
              aria-label="Góc nhìn Camera"
              value={cameraMode}
              onChange={(e) => onChangeCamera(e.target.value)}
              className="rounded border border-[#26374C] bg-[#111E30] text-slate-200 p-1 text-xs"
            >
              <option value="overview">Toàn cảnh Isometric</option>
              <option value="forklift">Theo xe nâng Forklift</option>
              <option value="pallet">Theo Pallet hàng</option>
              <option value="slot">Lấy nét ô kệ</option>
              <option value="free">Tự do xoay chuột</option>
            </select>
          </label>

          <Button
            size="sm"
            variant="outline"
            onClick={onResetCamera}
            className="border-[#26374C] bg-[#111E30] text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Đặt lại góc
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onToggleFullscreen}
            className="border-[#26374C] bg-[#111E30] text-slate-300 hover:text-white"
          >
            <Maximize2 className="w-3.5 h-3.5 mr-1" />
            Toàn màn hình
          </Button>
        </div>
      </div>
    </div>
  );
}
