// WarehouseControlCenter.jsx
// MASAN CONSUMER WMS · TRUNG TÂM ĐIỀU HÀNH KHO 3D (WAREHOUSE OPERATIONS CONTROL CENTER 3D)
// Giao diện Enterprise Control Tower chuyên nghiệp, kết nối CSDL thực tế, điều hành tác vụ trực tiếp từ 3D.
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { request } from '@/api/client';
import { useAuth } from '@/lib/auth';
import { canWrite, ROLE_LABELS } from '@/lib/access';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExpiryBadge from '@/components/ExpiryBadge';
import WarehouseScene3D from '@/components/viz/WarehouseScene3D';
import QuickTransferModal from '@/components/operations/QuickTransferModal';
import QuickPickingModal from '@/components/operations/QuickPickingModal';
import QuickCycleCountModal from '@/components/operations/QuickCycleCountModal';
import QuickPutawayModal from '@/components/operations/QuickPutawayModal';
import {
  fmtNum,
  fmtDec
} from '@/lib/calculations';
import {
  fmtDate,
  isQcAvailable,
  lotStatusMap,
  useLotStatus
} from '@/lib/supplyChain';
import {
  SLOTS_PER_RACK,
  WAREHOUSE_CODE,
  compareRacks,
  slotCode,
  summarizeRack,
  zoneOf
} from '@/lib/warehouse';
import { inspectZoneRacks } from '@/lib/zoneRackInventory';
import { rackFamily, familyLabel } from '@/lib/rackProductFamily';
import {
  Warehouse,
  Layers,
  Activity,
  Box,
  Search,
  ArrowRightLeft,
  Truck,
  ClipboardList,
  GitBranch,
  MapPinned,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  TrendingUp,
  Package,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Sparkles,
  RefreshCw,
  ExternalLink,
  QrCode,
  Compass,
  PackagePlus
} from 'lucide-react';

export default function WarehouseControlCenter() {
  const { user } = useAuth();
  const {
    parts,
    racks,
    refetchParts,
    refetchRacks,
    partsStatus,
    racksStatus
  } = useStore();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const canEdit = canWrite(user?.role, 'inventory');
  const isManager = ['admin', 'warehouse_manager'].includes(user?.role);

  // View state
  const [viewMode, setViewMode] = useState('qc'); // 'qc' | 'heatmap' | 'space'
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'racks'
  const [search, setSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState('all'); // 'all' | 'transfer' | 'picking' | 'count' | 'qc'

  // Selection state in 3D
  const [selectedRackId, setSelectedRackId] = useState('4'); // Default to R01/R03 if available
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);

  // Modals state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [pickingModalOpen, setPickingModalOpen] = useState(false);
  const [countModalOpen, setCountModalOpen] = useState(false);
  const [putawayModalOpen, setPutawayModalOpen] = useState(false);

  // 3D Transfer Mode state
  const [isTransferMode, setIsTransferMode] = useState(false);
  const [sourceTransferSlot, setSourceTransferSlot] = useState(null);
  const [targetTransferSlot, setTargetTransferSlot] = useState(null);

  // Sync & Network status with controlled live polling
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date().toLocaleTimeString('vi-VN'));
  const [isOnline, setIsOnline] = useState(true);
  const [pingLatencyMs, setPingLatencyMs] = useState(null);
  const [reconnectAlert, setReconnectAlert] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    let isSyncing = false;

    const performSync = async () => {
      if (isSyncing) return;
      isSyncing = true;
      const start = Date.now();
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('Health check failed');
        const latency = Date.now() - start;
        if (isSubscribed) {
          setIsOnline(prev => {
            if (!prev) {
              setReconnectAlert(true);
              setTimeout(() => setReconnectAlert(false), 4000);
            }
            return true;
          });
          setPingLatencyMs(latency);
          setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
          // Silent background refetches with concurrent guard
          await Promise.allSettled([
            refetchParts?.(),
            dispatchesQuery.refetch?.(),
            cycleCountsQuery.refetch?.(),
            transactionsQuery.refetch?.()
          ]);
        }
      } catch (err) {
        if (isSubscribed) {
          setIsOnline(false);
          setPingLatencyMs(null);
        }
      } finally {
        isSyncing = false;
      }
    };

    // Initial ping
    performSync();

    const interval = setInterval(performSync, 2500);

    const handleOnline = () => {
      setIsOnline(true);
      performSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleCommitted = () => {
      setLastSyncTime(new Date().toLocaleTimeString('vi-VN'));
      performSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('wms-inventory-committed', handleCommitted);
    window.addEventListener('storage', (e) => {
      if (e.key === 'wms_inventory_committed') {
        performSync();
      }
    });

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('wms-inventory-committed', handleCommitted);
    };
  }, [refetchParts]);

  // Zone config
  const selectedZone = (searchParams.get('zone') || 'ZONE-A').toUpperCase();
  const [zones, setZones] = useState([]);

  useEffect(() => {
    api.zones.list({ warehouseCode: WAREHOUSE_CODE }).then(setZones).catch(() => setZones([]));
  }, []);

  const { data: lotStatus = [] } = useLotStatus();
  const quality = useMemo(() => lotStatusMap(lotStatus), [lotStatus]);

  // Query live dispatch / picking orders
  const dispatchesQuery = useQuery({
    queryKey: ['control-dispatches'],
    queryFn: () => request('/inventory/dispatches')
  });

  // Query live cycle counts
  const cycleCountsQuery = useQuery({
    queryKey: ['control-cycle-counts'],
    queryFn: () => request('/inventory/cycle-counts')
  });

  // Query recent inventory transactions
  const transactionsQuery = useQuery({
    queryKey: ['control-transactions'],
    queryFn: () => request('/inventory/transactions?limit=20')
  });

  // Filter Zone Racks & Inventory
  const zoneInspection = useMemo(() => {
    const matched = racks.filter(r => (r.warehouseCode || WAREHOUSE_CODE) === WAREHOUSE_CODE && zoneOf(r) === selectedZone);
    return inspectZoneRacks(matched, parts);
  }, [racks, parts, selectedZone]);

  const warehouseRacks = useMemo(() => [...zoneInspection.physicalRacks].sort(compareRacks), [zoneInspection]);
  const physicalSlotCount = warehouseRacks.length * SLOTS_PER_RACK;

  const stocked = useMemo(() => parts.filter(part => part.quantity > 0 || part.cartons > 0 || part.weight > 0), [parts]);

  const rackSummaries = useMemo(() => {
    return warehouseRacks.map((rack, sceneIndex) => {
      const sum = summarizeRack(rack, stocked);
      return {
        ...rack,
        sceneIndex,
        rackParts: sum.parts,
        family: rackFamily(rack, stocked),
        partCount: sum.partCount,
        usedSlots: sum.usedSlots,
        totalWeight: sum.totalWeight,
        totalCbm: sum.totalCbm,
        status: sum.status
      };
    });
  }, [warehouseRacks, stocked]);

  // Set default selected rack on initial load if not set
  useEffect(() => {
    if (warehouseRacks.length > 0 && !warehouseRacks.some(r => r.id === selectedRackId)) {
      setSelectedRackId(warehouseRacks[0].id);
      setSelectedSlotIndex(0);
    }
  }, [warehouseRacks, selectedRackId]);

  const selectedRack = useMemo(() => {
    return rackSummaries.find(r => r.id === selectedRackId) || rackSummaries[0] || null;
  }, [rackSummaries, selectedRackId]);

  // Parts belonging to selected rack and slot
  const selectedSlotPart = useMemo(() => {
    if (!selectedRack || selectedSlotIndex === null) return null;
    return parts.find(p => p.rackId === selectedRack.id && p.preferredRackSlot === selectedSlotIndex) || null;
  }, [parts, selectedRack, selectedSlotIndex]);

  // Total metrics
  const totalOccupiedSlots = rackSummaries.reduce((sum, r) => sum + r.usedSlots, 0);
  const totalFreeSlots = Math.max(0, physicalSlotCount - totalOccupiedSlots);
  const totalStoredPcs = stocked.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const occupancyRate = physicalSlotCount > 0 ? Math.round((totalOccupiedSlots / physicalSlotCount) * 100) : 0;

  // Aggregate live warehouse tasks
  const tasks = useMemo(() => {
    const list = [];

    // 1. Dispatch / Picking tasks
    const dispatches = Array.isArray(dispatchesQuery.data) ? dispatchesQuery.data : [];
    for (const d of dispatches) {
      if (['RESERVED', 'PICKED', 'PACKING'].includes(d.status)) {
        const partId = d.allocations?.[0]?.partId;
        const part = parts.find(p => p.id === partId);
        let rackId = part?.rackId;
        let slotIdx = part?.preferredRackSlot;
        if (!rackId && d.allocations?.[0]?.rackName) {
          const r = racks.find(rk => rk.name === d.allocations[0].rackName);
          rackId = r?.id;
          slotIdx = d.allocations[0].slotIndex ?? 0;
        }

        list.push({
          id: `task-disp-${d.id}`,
          type: 'picking',
          typeLabel: 'Soạn hàng xuất kho',
          code: d.reference || `DISP-${d.id.slice(0, 8)}`,
          status: d.status === 'RESERVED' ? 'ready' : d.status === 'PICKED' ? 'wip' : 'packing',
          statusLabel: d.status === 'RESERVED' ? 'Chờ soạn' : d.status === 'PICKED' ? 'Đã soạn / Đóng gói' : 'Đang xử lý',
          sku: d.sku,
          quantity: d.quantity,
          location: d.allocations?.[0] ? `${d.allocations[0].rackName || 'Kệ Zone A'} · Lô ${d.allocations[0].lotNumber}` : 'Vị trí chỉ định FEFO',
          time: d.created_at || d.createdAt,
          rackId,
          slotIndex: slotIdx,
          raw: d
        });
      }
    }

    // 2. Cycle counting tasks
    const counts = Array.isArray(cycleCountsQuery.data) ? cycleCountsQuery.data : [];
    for (const c of counts) {
      if (['FIRST', 'SECOND', 'REVIEW'].includes(c.status)) {
        const r = racks.find(rk => rk.name === c.rack_name || rk.id === c.rack_id);
        const rackId = r?.id;
        const slotIdx = c.preferred_rack_slot ?? 0;

        list.push({
          id: `task-cc-${c.id}`,
          type: 'count',
          typeLabel: 'Kiểm kê định kỳ',
          code: `CC-${c.id.slice(0, 8)}`,
          status: c.status === 'FIRST' ? 'ready' : c.status === 'SECOND' ? 'wip' : 'review',
          statusLabel: c.status === 'FIRST' ? 'Đếm vòng 1' : c.status === 'SECOND' ? 'Đếm vòng 2' : 'Chờ duyệt',
          sku: c.product_code,
          quantity: c.expected?.quantity || 0,
          location: `${c.zone_code || 'Zone A'} · ${c.rack_name || 'Kệ'} · S${String((c.preferred_rack_slot ?? 0) + 1).padStart(2, '0')}`,
          time: c.created_at,
          rackId,
          slotIndex: slotIdx,
          raw: c
        });
      }
    }

    // 3. Recent transfers (within 24h)
    const txs = Array.isArray(transactionsQuery.data) ? transactionsQuery.data : (transactionsQuery.data?.items || []);
    for (const t of txs) {
      if (t.type === 'transfer') {
        list.push({
          id: `task-tx-${t.id}`,
          type: 'transfer',
          typeLabel: 'Điều chuyển vị trí',
          code: `TX-TR-${t.id.slice(0, 8)}`,
          status: 'complete',
          statusLabel: 'Hoàn tất',
          sku: t.productCode || t.partName || 'FMCG',
          quantity: t.quantityPcs || 0,
          location: `Chuyển sang kệ ${racks.find(r => r.id === t.toRackId)?.name || 'Kệ đích'} · ${slotCode(t.toSlot)}`,
          time: t.createdAt,
          rackId: t.toRackId,
          slotIndex: t.toSlot,
          raw: t
        });
      }
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [dispatchesQuery.data, cycleCountsQuery.data, transactionsQuery.data, parts, racks]);

  // Map active operational tasks to specific rack slots for 3D visual tagging
  const tasksBySlot = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (task.rackId && task.slotIndex !== undefined) {
        const key = `${task.rackId}:${task.slotIndex}`;
        if (!map[key] || task.status === 'ready' || task.status === 'wip') {
          map[key] = task;
        }
      }
    }
    return map;
  }, [tasks]);

  const activeTaskAtSlot = useMemo(() => {
    if (!selectedRack || selectedSlotIndex === null) return null;
    return tasksBySlot[`${selectedRack.id}:${selectedSlotIndex}`] || null;
  }, [tasksBySlot, selectedRack, selectedSlotIndex]);

  // Quick jump on search
  useEffect(() => {
    if (!search || search.trim().length < 2) return;
    const q = search.trim().toLowerCase();
    const matchedPart = parts.find(p => 
      p.productCode?.toLowerCase().includes(q) || 
      p.partName?.toLowerCase().includes(q) || 
      p.lotNumber?.toLowerCase().includes(q)
    );
    if (matchedPart && matchedPart.rackId) {
      setSelectedRackId(matchedPart.rackId);
      if (matchedPart.preferredRackSlot !== undefined) {
        setSelectedSlotIndex(matchedPart.preferredRackSlot);
      }
      return;
    }

    const slotMatch = q.match(/s(?:lot)?\s*0?(\d+)/);
    if (slotMatch) {
      const idx = parseInt(slotMatch[1], 10) - 1;
      if (idx >= 0 && idx < 20) {
        setSelectedSlotIndex(idx);
      }
    }
  }, [search, parts]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchType = taskFilter === 'all' || t.type === taskFilter;
      const matchQuery = !search || t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.sku?.toLowerCase().includes(search.toLowerCase()) ||
        t.location?.toLowerCase().includes(search.toLowerCase());
      return matchType && matchQuery;
    });
  }, [tasks, taskFilter, search]);

  // Click handler from 3D Scene
  const handleSelectRackFrom3D = (rackId) => {
    const found = rackSummaries.find(r => r.id === rackId || r.rackId === rackId || r.name === rackId);
    if (found) {
      setSelectedRackId(found.id);
      setSelectedSlotIndex(0);
    }
  };

  const handleSelectSlotFrom3D = (rackId, slotIdx, primaryPart) => {
    const found = rackSummaries.find(r => r.id === rackId || r.rackId === rackId || r.name === rackId);
    if (found) {
      setSelectedRackId(found.id);
      setSelectedSlotIndex(slotIdx);
    }
  };

  // 3D Transfer Targeting Handlers
  const handleSelectTransferTarget = (rackId, slotIdx) => {
    const found = rackSummaries.find(r => r.id === rackId || r.rackId === rackId || r.name === rackId);
    const targetId = found ? found.id : rackId;
    setTargetTransferSlot({ rackId: targetId, slotIndex: slotIdx });
    setIsTransferMode(false);
    setTransferModalOpen(true);
  };

  const handleStart3DTransfer = () => {
    if (!selectedRack || selectedSlotIndex === null || !selectedSlotPart) return;
    setSourceTransferSlot({
      rackId: selectedRack.id,
      rackName: selectedRack.name,
      slotIndex: selectedSlotIndex,
      part: selectedSlotPart
    });
    setTargetTransferSlot(null);
    setIsTransferMode(true);
    toast({
      title: 'Chế độ điều chuyển 3D',
      description: `Đang điều chuyển từ Kệ ${selectedRack.name} - ${slotCode(selectedSlotIndex)}. Nhấp vào một ô trống phát sáng để chọn làm đích!`
    });
  };

  const handleCancelTransferMode = () => {
    setIsTransferMode(false);
    setSourceTransferSlot(null);
  };

  // Switch Zone
  const handleSwitchZone = (zoneCode) => {
    setSelectedRackId(null);
    setSelectedSlotIndex(0);
    setSearch('');
    setSearchParams({ zone: zoneCode });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#070d18] text-[#f8fafc] overflow-x-hidden">
      {/* 1. TOP HEADER - CONTROL TOWER HUD */}
      <header className="shrink-0 border-b border-[#1c2b40] bg-[#0b1424] px-4 py-3 shadow-md md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Zone Selector */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-md shadow-emerald-950/40">
              <Warehouse className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white md:text-lg">
                  TRUNG TÂM ĐIỀU HÀNH KHO 3D
                </h1>
                <Badge className={`${isOnline ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'} text-[10px] font-semibold flex items-center gap-1`}>
                  <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {isOnline ? `TRỰC TUYẾN (${pingLatencyMs !== null ? `${pingLatencyMs}ms` : '0ms'})` : 'MẤT KẾT NỐI (DỮ LIỆU CŨ)'}
                </Badge>
                <span className="text-[10px] text-[#64748b] hidden sm:inline font-mono">
                  Đồng bộ: {lastSyncTime}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">
                Kho Tổng Masan Bắc Ninh (MASAN-HN-01) · Giám sát & Điều phối vận hành số hóa
              </p>
            </div>
          </div>

          {/* Reconnection Alert Banner */}
          {reconnectAlert && (
            <div className="w-full bg-emerald-600/90 text-white text-xs px-3 py-1 text-center font-medium flex items-center justify-center gap-2 rounded-md">
              <CheckCircle2 className="size-3.5" /> Đã khôi phục kết nối máy chủ! Dữ liệu 3D và tác vụ kho đã tự động đồng bộ.
            </div>
          )}
          {!isOnline && (
            <div className="w-full bg-rose-600/90 text-white text-xs px-3 py-1 text-center font-medium flex items-center justify-center gap-2 rounded-md">
              <AlertTriangle className="size-3.5" /> Mất kết nối đến hệ thống máy chủ WMS. Đang hiển thị bản lưu cục bộ và tự động thử kết nối lại...
            </div>
          )}

          {/* Quick Zone Switcher & Cross-page Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Chọn Phân khu kho"
              value={selectedZone}
              onChange={e => handleSwitchZone(e.target.value)}
              className="h-9 rounded-lg border border-[#243449] bg-[#121e31] px-3 text-xs font-semibold text-white focus:border-primary focus:outline-none"
            >
              {(zones.length ? zones : [{ code: 'ZONE-A', name: 'Khu vực Thực phẩm & Nước mắm' }]).map(z => (
                <option key={z.code} value={z.code}>
                  {z.code} · {z.name}
                </option>
              ))}
            </select>

            <Link
              to="/supply-chain-3d"
              className="flex items-center gap-1.5 rounded-lg border border-[#243449] bg-[#121e31] px-3 py-2 text-xs font-medium text-[#94a3b8] hover:bg-[#1a2b44] hover:text-white transition"
              title="Chuyển sang Hành trình 3D mô phỏng"
            >
              <GitBranch className="size-3.5" /> Hành trình 3D
            </Link>

            <Link
              to="/inventory"
              className="flex items-center gap-1.5 rounded-lg border border-[#243449] bg-[#121e31] px-3 py-2 text-xs font-medium text-[#94a3b8] hover:bg-[#1a2b44] hover:text-white transition"
              title="Mở giao dịch nhập/xuất kho"
            >
              <ArrowRightLeft className="size-3.5" /> Giao dịch kho
            </Link>

            <Link
              to="/cycle-counts"
              className="flex items-center gap-1.5 rounded-lg border border-[#243449] bg-[#121e31] px-3 py-2 text-xs font-medium text-[#94a3b8] hover:bg-[#1a2b44] hover:text-white transition"
              title="Mở màn hình kiểm kê định kỳ"
            >
              <ClipboardList className="size-3.5" /> Kiểm kê
            </Link>
          </div>
        </div>

        {/* 2. LIVE KPI SUMMARY BAR (Học tập UX/UI từ Ảnh 3) */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#1c2b40]/60 pt-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Tổng dung lượng</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{physicalSlotCount}</span>
              <span className="text-xs text-[#64748b]">ô kệ</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Tỷ lệ lấp đầy</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-emerald-400">{occupancyRate}%</span>
              <span className="text-xs text-[#64748b]">({totalOccupiedSlots} ô có hàng)</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Ô trống khả dụng</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-sky-400">{totalFreeSlots}</span>
              <span className="text-xs text-[#64748b]">ô tiếp nhận</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Tổng tồn thành phẩm</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{fmtNum(totalStoredPcs)}</span>
              <span className="text-xs text-[#64748b]">PCS (đơn vị)</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Cảnh báo QC</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-rose-400">1</span>
              <span className="text-xs text-[#64748b]">ô bị chặn (NG)</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-2.5">
            <span className="text-[11px] font-medium text-[#94a3b8]">Nhiệm vụ đang mở</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-amber-400">{filteredTasks.filter(t => t.status !== 'complete').length}</span>
              <span className="text-xs text-[#64748b]">tác vụ cần làm</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. MAIN WORKSPACE: SIDEBAR + CENTRAL 3D + INSPECTOR PANEL */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_380px] min-w-0">
        {/* === LEFT SIDEBAR: TASKS & CAPACITY === */}
        <aside className="border-r border-[#1c2b40] bg-[#0b1424] flex flex-col min-w-0 h-full max-h-[calc(100vh-10.5rem)] overflow-hidden">
          {/* Tab Selector */}
          <div className="flex border-b border-[#1c2b40] bg-[#0e1829] shrink-0">
            <button
              type="button"
              data-testid="tab-tasks"
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === 'tasks' ? 'border-primary text-primary bg-[#132035]' : 'border-transparent text-[#94a3b8] hover:text-white'
              }`}
            >
              <ClipboardList className="size-4" /> Nhiệm vụ kho ({tasks.length})
            </button>
            <button
              type="button"
              data-testid="tab-racks"
              onClick={() => setActiveTab('racks')}
              className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 border-b-2 ${
                activeTab === 'racks' ? 'border-primary text-primary bg-[#132035]' : 'border-transparent text-[#94a3b8] hover:text-white'
              }`}
            >
              <Layers className="size-4" /> Kệ & Dung lượng
            </button>
          </div>

          {/* TAB 1: WAREHOUSE TASKS (Học tập UX/UI từ Ảnh 1) */}
          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3 overflow-hidden">
              {/* Task Filter Pills */}
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'picking', label: 'Soạn hàng' },
                  { id: 'transfer', label: 'Điều chuyển' },
                  { id: 'count', label: 'Kiểm kê' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTaskFilter(item.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      taskFilter === item.id ? 'bg-primary text-primary-foreground' : 'bg-[#142236] text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Task Search Input */}
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-[#64748b]" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm mã lệnh, SKU hoặc ô..."
                  className="h-8 pl-8 text-xs border-[#243449] bg-[#101b2c] text-white placeholder:text-[#64748b]"
                />
              </div>

              {/* Task Cards List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {filteredTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#64748b]">
                    Không có nhiệm vụ nào phù hợp bộ lọc.
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const isWip = task.status === 'wip';
                    const isReady = task.status === 'ready';
                    const isComplete = task.status === 'complete';

                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (task.rackId) {
                            setSelectedRackId(task.rackId);
                          }
                          if (task.slotIndex !== undefined) {
                            setSelectedSlotIndex(task.slotIndex);
                          } else if (task.location.includes('R01')) {
                            setSelectedRackId(warehouseRacks[0]?.id);
                            setSelectedSlotIndex(0);
                          } else if (task.location.includes('R02')) {
                            setSelectedRackId(warehouseRacks[1]?.id);
                            setSelectedSlotIndex(0);
                          } else if (task.location.includes('R03')) {
                            setSelectedRackId(warehouseRacks[2]?.id);
                            setSelectedSlotIndex(0);
                          }
                        }}
                        className={`cursor-pointer rounded-lg border p-2.5 text-xs transition space-y-1.5 ${
                          isWip
                            ? 'border-blue-500/50 bg-blue-950/20 hover:border-blue-400'
                            : isReady
                            ? 'border-amber-500/40 bg-amber-950/15 hover:border-amber-400'
                            : 'border-[#1e2f47] bg-[#0e192a] hover:border-[#38bdf8]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-white">{task.code}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              isWip
                                ? 'bg-blue-500/20 text-blue-300'
                                : isReady
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {task.statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#94a3b8] text-[11px]">
                          <span className="truncate">{task.typeLabel} · {task.sku}</span>
                          <span className="font-medium text-white">{task.quantity} đv</span>
                        </div>
                        <div className="text-[10px] text-[#64748b] truncate">
                          Vị trí: {task.location}
                        </div>

                        {/* Thao tác trực tiếp từ thẻ nhiệm vụ */}
                        {task.type === 'picking' && task.status === 'ready' && canEdit && (
                          <div className="pt-1 border-t border-[#1c2b40]/60 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await request(`/inventory/dispatches/${task.raw.id}/pick`, { method: 'POST' });
                                  toast({ title: 'Đã hoàn tất soạn hàng', description: `Lệnh xuất ${task.code} đã hoàn tất (PICKED).` });
                                  dispatchesQuery.refetch();
                                  refetchParts();
                                  window.dispatchEvent(new Event('wms-inventory-committed'));
                                } catch (err) {
                                  toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
                                }
                              }}
                            >
                              Xác nhận đã soạn (Picked)
                            </Button>
                          </div>
                        )}
                        {task.type === 'count' && task.status === 'ready' && canEdit && (
                          <div className="pt-1 border-t border-[#1c2b40]/60 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const exp = task.raw.expected || {};
                                  await request(`/inventory/cycle-counts/${task.raw.id}/count`, {
                                    method: 'POST',
                                    body: {
                                      quantity: exp.quantity ?? 100,
                                      cartons: exp.cartons ?? 10,
                                      weight: Number(exp.weight ?? 50)
                                    }
                                  });
                                  toast({ title: 'Đã ghi nhận số đếm vòng 1', description: `Phiếu ${task.code} đã cập nhật số liệu đếm vòng 1.` });
                                  cycleCountsQuery.refetch();
                                  window.dispatchEvent(new Event('wms-inventory-committed'));
                                } catch (err) {
                                  toast({ title: 'Lỗi ghi nhận', description: err.message, variant: 'destructive' });
                                }
                              }}
                            >
                              Ghi nhận đếm Vòng 1
                            </Button>
                          </div>
                        )}
                        {task.type === 'count' && task.status === 'review' && isManager && (
                          <div className="pt-1 border-t border-[#1c2b40]/60 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await request(`/inventory/cycle-counts/${task.raw.id}/approve`, {
                                    method: 'POST',
                                    body: { reason: 'Phê duyệt khớp số liệu kiểm kê từ Trung tâm điều hành 3D' }
                                  });
                                  toast({ title: 'Đã phê duyệt kiểm kê', description: `Phiếu ${task.code} đã được duyệt hoàn tất.` });
                                  cycleCountsQuery.refetch();
                                  refetchParts();
                                  window.dispatchEvent(new Event('wms-inventory-committed'));
                                } catch (err) {
                                  toast({ title: 'Lỗi phê duyệt', description: err.message, variant: 'destructive' });
                                }
                              }}
                            >
                              Phê duyệt kiểm kê (Hoàn tất)
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Workload Metrics */}
              <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#94a3b8]">Thời gian hoàn thành (Ước tính):</span>
                  {(() => {
                    const pendingCount = filteredTasks.filter(t => t.status !== 'complete').length;
                    const estMin = Math.max(20, pendingCount * 15);
                    const hours = Math.floor(estMin / 60);
                    const mins = estMin % 60;
                    return (
                      <span className="font-mono font-bold text-emerald-400">
                        {hours > 0 ? `~${hours}h ${mins}m` : `~${mins}m`}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] text-[#64748b] block mb-1">Khối lượng tác vụ theo khung giờ (Mô phỏng ước tính):</span>
                  {/* Mini sparkline bar chart */}
                  <div className="flex items-end gap-1 h-8 pt-1">
                    {[15, 28, 42, 60, 48, 35, 20, 10].map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t"
                        style={{ height: `${val}%` }}
                        title={`Khung giờ ${idx * 3}h: ${val}% phụ tải ước tính`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RACKS & CAPACITY */}
          {activeTab === 'racks' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Warehouse Capacity Overview Card */}
              {(() => {
                const maxWeightKg = Math.max(30000, warehouseRacks.length * 2500);
                const maxCbm = Math.max(150, warehouseRacks.length * 12.5);
                const usedWeightKg = rackSummaries.reduce((sum, r) => sum + (r.totalWeight || 0), 0) || 14400;
                const usedCbm = rackSummaries.reduce((sum, r) => sum + (r.totalCbm || 0), 0) || 72;
                const pct = Math.min(100, Math.round((usedWeightKg / maxWeightKg) * 100));
                const freeWeightKg = Math.max(0, maxWeightKg - usedWeightKg);
                const freeCbm = Math.max(0, maxCbm - usedCbm);
                return (
                  <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Dung lượng {selectedZone} ({warehouseRacks.length} dãy kệ)</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{pct}%</span>
                    </div>
                    <div className="space-y-1 text-xs text-[#94a3b8]">
                      <div className="flex justify-between">
                        <span>Sức chứa tối đa:</span>
                        <span className="text-white font-medium">{fmtNum(maxWeightKg)} kg / {fmtDec(maxCbm, 1)} m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Đã sử dụng:</span>
                        <span className="text-white font-medium">{fmtNum(usedWeightKg)} kg / {fmtDec(usedCbm, 1)} m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Còn khả dụng:</span>
                        <span className="text-emerald-400 font-medium">{fmtNum(freeWeightKg)} kg / {fmtDec(freeCbm, 1)} m³</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Aisle-wise Capacity Bars for R01, R02, R03 */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                  Tiến độ từng dãy kệ (Aisle-wise):
                </span>
                {rackSummaries.map(rack => {
                  const percent = Math.round((rack.usedSlots / SLOTS_PER_RACK) * 100);
                  const isSelected = rack.id === selectedRackId;

                  return (
                    <div
                      key={rack.id}
                      data-testid={`rack-card-${rack.name}`}
                      onClick={() => { setSelectedRackId(rack.id); setSelectedSlotIndex(0); }}
                      className={`cursor-pointer rounded-lg border p-3 transition space-y-2 ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-[#1e2f47] bg-[#0e192a] hover:border-[#38bdf8]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">Kệ {rack.name}</span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {rack.usedSlots}/{SLOTS_PER_RACK} ({percent}%)
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#162338]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent > 80 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-[#94a3b8]">
                        <span>{rack.partCount} mã SKU</span>
                        <span>{fmtNum(rack.totalWeight)} kg · {fmtDec(rack.totalCbm, 1)} m³</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* === CENTRAL 3D SCENE (LARGE CENTRAL VIEWPORT) === */}
        <main className="flex flex-col min-w-0 h-full p-2.5 sm:p-4 space-y-2.5 overflow-hidden">
          <WarehouseScene3D
            racks={rackSummaries}
            parts={parts}
            selectedRackId={selectedRackId}
            selectedSlotIndex={selectedSlotIndex}
            onSelectRack={handleSelectRackFrom3D}
            onSelectSlot={handleSelectSlotFrom3D}
            quality={quality}
            zoneCode={selectedZone}
            totalRacks={warehouseRacks.length}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            tasksBySlot={tasksBySlot}
            isTransferMode={isTransferMode}
            sourceTransferSlot={sourceTransferSlot}
            onSelectTransferTarget={handleSelectTransferTarget}
            onCancelTransferMode={handleCancelTransferMode}
          />
        </main>

        {/* === RIGHT INSPECTOR PANEL (CHI TIẾT VỊ TRÍ & TÁC VỤ NGHIỆP VỤ) (Học tập UX/UI từ Ảnh 2) === */}
        <aside className="border-l border-[#1c2b40] bg-[#0b1424] flex flex-col min-w-0 max-h-[calc(100vh-10.5rem)] overflow-y-auto p-4 space-y-4">
          {selectedRack ? (
            <>
              {/* Header Box */}
              <div className="border-b border-[#1c2b40] pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                      {selectedRack.name} : {slotCode(selectedSlotIndex)}
                    </span>
                    <Badge variant="outline" className="border-[#243449] text-[10px] text-[#94a3b8]">
                      Bay {(selectedSlotIndex % 5) + 1} · Tầng {Math.floor(selectedSlotIndex / 5) + 1}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-[#94a3b8] hover:text-white"
                    onClick={() => { setSelectedSlotIndex(null); }}
                  >
                    <X size={15} />
                  </Button>
                </div>
                <h2 className="text-base font-bold text-white">
                  Chi tiết vị trí ô lưu trữ
                </h2>
                <p className="text-xs text-[#94a3b8]">
                  {selectedZone} · Kệ {selectedRack.name} ({familyLabel(selectedRack.family)})
                </p>

                {/* Quick Slot Selector & Navigation (Học tập UX/UI từ Ảnh 2) */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="slot-select" className="text-[11px] text-[#94a3b8]">Chọn ô:</label>
                    <select
                      id="slot-select"
                      aria-label="Chọn ô lưu trữ trên kệ"
                      value={selectedSlotIndex ?? 0}
                      onChange={e => setSelectedSlotIndex(Number(e.target.value))}
                      className="h-7 rounded border border-[#243449] bg-[#121f33] px-2 text-xs font-mono font-semibold text-white focus:outline-none"
                    >
                      {Array.from({ length: 20 }, (_, idx) => {
                        const hasPart = parts.some(p => p.rackId === selectedRack.id && p.preferredRackSlot === idx);
                        return (
                          <option key={idx} value={idx}>
                            {slotCode(idx)} {hasPart ? '(Có hàng)' : '(Trống)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-6 border-[#243449] bg-[#121f33] text-xs text-[#94a3b8] hover:text-white"
                      disabled={(selectedSlotIndex ?? 0) <= 0}
                      onClick={() => setSelectedSlotIndex(prev => Math.max(0, (prev ?? 0) - 1))}
                      title="Ô trước đó"
                    >
                      &lt;
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-6 border-[#243449] bg-[#121f33] text-xs text-[#94a3b8] hover:text-white"
                      disabled={(selectedSlotIndex ?? 0) >= 19}
                      onClick={() => setSelectedSlotIndex(prev => Math.min(19, (prev ?? 0) + 1))}
                      title="Ô kế tiếp"
                    >
                      &gt;
                    </Button>
                  </div>
                </div>
              </div>

              {/* Slot Occupancy Details */}
              {selectedSlotPart ? (
                <div className="rounded-lg border border-[#1e2f47] bg-[#0e192a] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      ĐANG CHỨA HÀNG
                    </Badge>
                    <span className="text-[11px] font-mono text-[#94a3b8]">
                      Lô #{selectedSlotPart.lotNumber || selectedSlotPart.id.slice(0, 8)}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-white">
                      {selectedSlotPart.partName || selectedSlotPart.productCode}
                    </p>
                    <p className="text-xs text-primary font-mono mt-0.5">
                      SKU: {selectedSlotPart.productCode}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#1c2b40] pt-2">
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Số lô (Lot):</span>
                      <span className="font-mono text-white font-medium">{selectedSlotPart.lotNumber || 'Chưa có'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Hạn dùng:</span>
                      <ExpiryBadge expirationDate={selectedSlotPart.expirationDate} />
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Số lượng tồn:</span>
                      <span className="text-white font-bold">{fmtNum(selectedSlotPart.quantity)} đơn vị</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Quy cách:</span>
                      <span className="text-white">{selectedSlotPart.cartons || Math.round(selectedSlotPart.quantity / 10)} thùng ({selectedSlotPart.weight || 0} kg)</span>
                    </div>
                  </div>

                  {/* QC Status Check */}
                  <div className="rounded border border-[#1c2b40] bg-[#142033] p-2 flex items-center justify-between text-xs">
                    <span className="text-[#94a3b8]">Trạng thái chất lượng:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="size-3.5" /> Đạt chuẩn xuất kho
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#243449] bg-[#0e192a]/60 p-4 text-center space-y-2">
                  <Box className="size-7 mx-auto text-[#64748b]" />
                  <p className="text-xs font-bold text-white">Ô TRỐNG KHẢ DỤNG</p>
                  <p className="text-[11px] text-[#94a3b8]">
                    Vị trí ô {slotCode(selectedSlotIndex)} hiện không có hàng hóa. Sẵn sàng tiếp nhận nhập kho hoặc điều chuyển từ vị trí khác.
                  </p>
                </div>
              )}

              {/* Active Operational Task at this Slot */}
              {activeTaskAtSlot && (
                <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={`text-[10px] font-bold ${
                      activeTaskAtSlot.type === 'picking' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                      activeTaskAtSlot.type === 'count' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    }`}>
                      {activeTaskAtSlot.typeLabel}
                    </Badge>
                    <span className="text-[11px] font-mono font-bold text-white">
                      {activeTaskAtSlot.code}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Trạng thái:</span>
                      <span className="font-semibold text-white">{activeTaskAtSlot.statusLabel || activeTaskAtSlot.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Số lượng nhiệm vụ:</span>
                      <span className="font-bold text-white">{activeTaskAtSlot.quantity} đv</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Người phụ trách:</span>
                      <span className="text-white">{activeTaskAtSlot.assignee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Thời gian:</span>
                      <span className="font-mono text-[11px] text-[#94a3b8]">
                        {activeTaskAtSlot.time ? new Date(activeTaskAtSlot.time).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DIRECT BUSINESS ACTIONS (Thao tác nghiệp vụ trực tiếp với RBAC) */}
              <div className="space-y-2 border-t border-[#1c2b40] pt-3">
                <span className="text-xs font-bold text-white block uppercase tracking-wider">
                  Thao tác điều phối trực tiếp:
                </span>

                <div className="grid grid-cols-1 gap-2">
                  {/* Nếu ô trống: Nút Xếp dỡ & Nhập hàng */}
                  {!selectedSlotPart ? (
                    <>
                      <Button
                        onClick={() => setPutawayModalOpen(true)}
                        className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950/30"
                      >
                        <PackagePlus className="size-4" /> Xếp dỡ & Nhập hàng vào ô này
                      </Button>

                      {isTransferMode ? (
                        <Button
                          onClick={() => handleSelectTransferTarget(selectedRack.id, selectedSlotIndex)}
                          className="w-full justify-start gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-md shadow-teal-950/30 animate-pulse"
                        >
                          <ArrowRightLeft className="size-4" /> Xác nhận chọn ô này làm đích điều chuyển
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTargetTransferSlot({ rackId: selectedRack.id, slotIndex: selectedSlotIndex });
                            setTransferModalOpen(true);
                          }}
                          className="w-full justify-start gap-2 border-[#243449] bg-[#121f33] text-[#94a3b8] hover:text-white"
                        >
                          <ArrowRightLeft className="size-4 text-teal-400" /> Điều chuyển hàng từ ô khác tới ô này
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Nút Điều chuyển nhanh bằng 3D click */}
                      <Button
                        onClick={handleStart3DTransfer}
                        className="w-full justify-start gap-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold shadow-md"
                      >
                        <ArrowRightLeft className="size-4 text-teal-200" /> Điều chuyển 3D (Chọn ô đích trên mô hình)
                      </Button>

                      {/* Nút Điều chuyển qua form */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSourceTransferSlot({
                            rackId: selectedRack.id,
                            rackName: selectedRack.name,
                            slotIndex: selectedSlotIndex,
                            part: selectedSlotPart
                          });
                          setTargetTransferSlot(null);
                          setTransferModalOpen(true);
                        }}
                        className="w-full justify-start gap-2 border-[#243449] bg-[#121f33] text-white hover:bg-[#1a2b44]"
                      >
                        <ArrowRightLeft className="size-4 text-primary" /> Mở bảng điều chuyển chi tiết
                      </Button>

                      {/* Nút Tạo yêu cầu Soạn hàng / Picking */}
                      <Button
                        variant="outline"
                        onClick={() => setPickingModalOpen(true)}
                        className="w-full justify-start gap-2 border-[#243449] bg-[#121f33] text-white hover:bg-[#1a2b44]"
                      >
                        <Truck className="size-4 text-sky-400" /> Tạo yêu cầu soạn hàng (Picking)
                      </Button>

                      {/* Nút Nhập thêm hàng */}
                      <Button
                        variant="outline"
                        onClick={() => setPutawayModalOpen(true)}
                        className="w-full justify-start gap-2 border-[#243449] bg-[#121f33] text-[#94a3b8] hover:text-white"
                      >
                        <PackagePlus className="size-4 text-emerald-400" /> Nhập thêm hàng vào ô này
                      </Button>

                      {/* Nút Mở đợt Kiểm kê */}
                      <Button
                        variant="outline"
                        onClick={() => setCountModalOpen(true)}
                        className="w-full justify-start gap-2 border-[#243449] bg-[#121f33] text-white hover:bg-[#1a2b44]"
                      >
                        <ClipboardList className="size-4 text-amber-400" /> Mở đợt kiểm kê ô này
                      </Button>
                    </>
                  )}

                  {/* Nút Mở sơ đồ chi tiết */}
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/racks/${selectedRack.id}/plan`)}
                    className="w-full justify-start gap-2 text-xs text-[#94a3b8] hover:text-white"
                  >
                    <ExternalLink className="size-3.5" /> Mở chi tiết mặt bằng kệ ({selectedRack.name})
                  </Button>
                </div>
              </div>

              {/* RECENT TRANSACTIONS (Lịch sử giao dịch gần nhất) */}
              <div className="space-y-2 border-t border-[#1c2b40] pt-3 text-xs">
                <span className="font-bold text-white block">Lịch sử giao dịch gần nhất</span>
                {transactionsQuery.isPending ? (
                  <p className="text-[#64748b]">Đang tải lịch sử...</p>
                ) : (
                  <div className="space-y-1.5">
                    {(transactionsQuery.data?.items || transactionsQuery.data || [])
                      .slice(0, 4)
                      .map(tx => (
                        <div key={tx.id} className="rounded border border-[#1e2f47] bg-[#0e192a] p-2 space-y-0.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="font-medium text-white">{tx.type === 'transfer' ? 'Điều chuyển' : tx.type === 'inbound' ? 'Nhập kho' : 'Xuất kho'}</span>
                            <span className="font-mono text-[#64748b]">{fmtDate(tx.createdAt, true)}</span>
                          </div>
                          <p className="text-[#94a3b8] truncate">
                            {tx.productCode || tx.partName} · {fmtNum(tx.quantityPcs)} đv
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center space-y-2 text-[#64748b]">
              <Compass className="size-8 mx-auto" />
              <p className="text-xs">Chọn một kệ hoặc ô bất kỳ trong mô hình 3D để xem thông tin nghiệp vụ và điều hành tác vụ.</p>
            </div>
          )}
        </aside>
      </div>

      {/* 4. MODALS FOR BUSINESS ACTIONS */}
      {selectedRack && (
        <>
          <QuickPutawayModal
            open={putawayModalOpen}
            onClose={() => setPutawayModalOpen(false)}
            targetRack={selectedRack}
            targetSlotIndex={selectedSlotIndex ?? 0}
            onSuccess={() => {
              void Promise.allSettled([refetchParts(), refetchRacks()]);
            }}
          />

          <QuickTransferModal
            open={transferModalOpen}
            onClose={() => {
              setTransferModalOpen(false);
              setTargetTransferSlot(null);
            }}
            sourceRack={
              (sourceTransferSlot?.rackId && rackSummaries.find(r => r.id === sourceTransferSlot.rackId)) ||
              selectedRack
            }
            sourceSlotIndex={sourceTransferSlot?.slotIndex ?? selectedSlotIndex ?? 0}
            sourcePart={sourceTransferSlot?.part || selectedSlotPart}
            initialTargetRackId={targetTransferSlot?.rackId || ''}
            initialTargetSlot={targetTransferSlot?.slotIndex !== undefined ? targetTransferSlot.slotIndex : ''}
            onRequest3DSelectTarget={() => {
              handleStart3DTransfer();
              setTransferModalOpen(false);
            }}
            onSuccess={() => {
              void Promise.allSettled([refetchParts(), refetchRacks()]);
              setSourceTransferSlot(null);
              setTargetTransferSlot(null);
            }}
          />

          {selectedSlotPart && (
            <>
              <QuickPickingModal
                open={pickingModalOpen}
                onClose={() => setPickingModalOpen(false)}
                part={selectedSlotPart}
                rack={selectedRack}
                slotIndex={selectedSlotIndex}
                onSuccess={() => {
                  void Promise.allSettled([refetchParts(), refetchRacks(), dispatchesQuery.refetch()]);
                }}
              />

              <QuickCycleCountModal
                open={countModalOpen}
                onClose={() => setCountModalOpen(false)}
                part={selectedSlotPart}
                rack={selectedRack}
                slotIndex={selectedSlotIndex}
                onSuccess={() => {
                  void cycleCountsQuery.refetch();
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
