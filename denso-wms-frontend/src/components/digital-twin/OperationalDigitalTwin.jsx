// OperationalDigitalTwin.jsx
// Master Operational Warehouse Digital Twin for MASAN Consumer WMS.
// Integrates WMS Backend, Simulation Engine, Navigation Graph, 3D Canvas, Timeline & Inspector.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Warehouse3DCanvas from './Warehouse3DCanvas';
import DigitalTwinHUD from './DigitalTwinHUD';
import DigitalTwinTimeline from './DigitalTwinTimeline';
import DigitalTwinInspector from './DigitalTwinInspector';
import {
  fetchWarehouseRacks,
  fetchWarehouseParts,
  fetchQualityStatuses,
  fetchReceivingReceipts,
  fetchDispatchOrders,
  fetchTransactions
} from '@/lib/digital-twin/inventoryAdapter';
import {
  normalizeTransactionsToEvents,
  normalizeReceiptToEventSequence,
  DOMAIN_EVENT_TYPES
} from '@/lib/digital-twin/eventNormalizer';
import {
  evaluateSimulationFrame,
  evaluateAGVFrame
} from '@/lib/digital-twin/simulationOrchestrator';
import {
  buildUnifiedWarehouseModel,
  SHARED_WAREHOUSE_COORDINATES
} from '@/lib/viz/warehouseLayoutAdapter';
import { mapBusinessSlotToScene } from '@/lib/viz/sceneCoordinateMapper';

export default function OperationalDigitalTwin() {
  const containerRef = useRef(null);

  // 1. Digital Twin States
  const [mode, setMode] = useState('LIVE'); // 'LIVE', 'REPLAY', 'SANDBOX'
  const [activeLayer, setActiveLayer] = useState('qc'); // 'qc', 'sku', 'expiry', 'normal'
  const [cameraMode, setCameraMode] = useState('overview'); // 'overview', 'forklift', 'pallet', 'slot', 'free'
  const [selectedZone, setSelectedZone] = useState('ZONE-A');
  const [resetKey, setResetKey] = useState(0);

  // Playback & Kinematics Timeline
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [speed, setSpeed] = useState(1);
  const [activeEvent, setActiveEvent] = useState(null);
  const [targetSlotCoords, setTargetSlotCoords] = useState(null);
  const [isExecutingSlice, setIsExecutingSlice] = useState(false);

  // Object Inspector
  const [selectedItem, setSelectedItem] = useState(null);

  // 2. Fetch Real WMS Data from Backend APIs
  const racksQuery = useQuery({ queryKey: ['dt-racks'], queryFn: fetchWarehouseRacks, refetchInterval: 15000 });
  const partsQuery = useQuery({ queryKey: ['dt-parts'], queryFn: fetchWarehouseParts, refetchInterval: 15000 });
  const qcQuery = useQuery({ queryKey: ['dt-qc'], queryFn: fetchQualityStatuses, refetchInterval: 15000 });
  const receiptsQuery = useQuery({ queryKey: ['dt-receipts'], queryFn: fetchReceivingReceipts });
  const dispatchesQuery = useQuery({ queryKey: ['dt-dispatches'], queryFn: fetchDispatchOrders });
  const txQuery = useQuery({ queryKey: ['dt-tx'], queryFn: fetchTransactions });

  const lastSyncTime = partsQuery.dataUpdatedAt
    ? new Date(partsQuery.dataUpdatedAt).toLocaleTimeString('vi-VN')
    : null;

  // 3. Build Unified Warehouse 3D Model
  const rawRacks = racksQuery.data || [];
  const rawParts = partsQuery.data || [];
  const rawStatuses = qcQuery.data || [];

  const qualityMap = useMemo(() => {
    const m = new Map();
    for (const s of rawStatuses) {
      if (s.qualityScopeId) m.set(s.qualityScopeId, s);
      if (s.lotId) m.set(s.lotId, s);
    }
    return m;
  }, [rawStatuses]);

  const unifiedModel = useMemo(() => {
    return buildUnifiedWarehouseModel(rawRacks, rawParts, qualityMap, selectedZone);
  }, [rawRacks, rawParts, qualityMap, selectedZone]);

  // Maps for fast event normalizer lookups
  const partsMap = useMemo(() => {
    const m = new Map();
    for (const p of rawParts) m.set(p.id, p);
    return m;
  }, [rawParts]);

  const racksMap = useMemo(() => {
    const m = new Map();
    for (const r of rawRacks) m.set(r.id || r.name, r);
    return m;
  }, [rawRacks]);

  // Normalized Events for Historical Replay
  const historicalEvents = useMemo(() => {
    return normalizeTransactionsToEvents(txQuery.data || [], partsMap, racksMap);
  }, [txQuery.data, partsMap, racksMap]);

  // 4. Animation Kinematics Loop
  const [agvTime, setAgvTime] = useState(0);

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setAgvTime((t) => t + delta);

      if (isPlaying) {
        setProgress((prev) => {
          const step = (delta * speed) / 16; // 16 seconds full cycle at 1x
          const next = prev + step;
          if (next >= 1) {
            setIsPlaying(false);
            setIsExecutingSlice(false);
            return 1;
          }
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed]);

  // Evaluate Vehicle & Pallet Frame
  const simFrame = useMemo(() => {
    return evaluateSimulationFrame(activeEvent, progress, targetSlotCoords);
  }, [activeEvent, progress, targetSlotCoords]);

  const agvFrame = useMemo(() => {
    return evaluateAGVFrame(agvTime);
  }, [agvTime]);

  // 5. Interactive Handlers
  const handleSelectSlot = useCallback((slotInfo) => {
    setSelectedItem({
      type: 'slot',
      ...slotInfo
    });
    // Set target slot coords for camera focus
    const coords = mapBusinessSlotToScene(slotInfo.rack, slotInfo.slotIndex, rawRacks, selectedZone);
    setTargetSlotCoords(coords);
  }, [rawRacks, selectedZone]);

  const handleSelectRack = useCallback((rack) => {
    setSelectedItem({
      type: 'rack',
      rack,
      slotKey: rack.name,
      isOccupied: rack.usedSlots > 0,
      part: null
    });
  }, []);

  const handleSelectForklift = useCallback(() => {
    setSelectedItem({
      type: 'vehicle',
      slotKey: 'FORKLIFT-01 (XE NÂNG CHÍNH)',
      isOccupied: Boolean(simFrame?.pallet?.attached),
      part: simFrame?.pallet?.attached ? activeEvent : null
    });
    setCameraMode('forklift');
  }, [simFrame, activeEvent]);

  const handleSelectAGV = useCallback(() => {
    setSelectedItem({
      type: 'vehicle',
      slotKey: 'AGV-01 (XE TỰ HÀNH ĐIỀU PHỐI)',
      isOccupied: agvFrame.cargoVisible,
      part: null
    });
  }, [agvFrame]);

  // 6. Trigger Vertical Slice Inbound Cycle
  const handleTriggerVerticalSlice = useCallback(() => {
    setIsExecutingSlice(true);
    setProgress(0);
    setIsPlaying(true);
    setCameraMode('forklift');

    // Pick target slot: R01:S04 (Bay 4, Level 1)
    const targetSlotIndex = 3; // 4th slot
    const targetRack = rawRacks.find((r) => r.name === 'R01' || r.code === 'R01') || rawRacks[0] || { name: 'R01' };
    const coords = mapBusinessSlotToScene(targetRack, targetSlotIndex, rawRacks, 'ZONE-A');
    setTargetSlotCoords(coords);

    // Create synthetic domain event for the vertical slice
    const sliceEvent = {
      id: 'PO-INBOUND-VERTICAL-SLICE',
      type: DOMAIN_EVENT_TYPES.PUTAWAY_STARTED,
      label: 'Nhập kho mẫu: 1 Pallet Chinsu 250g → Kệ R01:S04',
      sku: 'MSN-CHINSU-CHILI-250',
      partName: 'Tương ớt Chinsu Chai 250g',
      lotNumber: 'L-20261112-01',
      quantityPcs: 100,
      expirationDate: '2027-05-15',
      qcStatus: 'AVAILABLE'
    };
    setActiveEvent(sliceEvent);
    setSelectedItem({
      type: 'slot',
      rack: targetRack,
      slotIndex: targetSlotIndex,
      slotCode: 'S04',
      slotKey: 'R01:S04',
      level: 1,
      bay: 4,
      isOccupied: true,
      part: sliceEvent
    });
  }, [rawRacks]);

  // Toggle Fullscreen
  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen not supported:', err);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-140px)] min-h-[620px] rounded-2xl overflow-hidden border border-[#1A2C42] bg-[#080F1C] flex flex-col shadow-2xl fullscreen:h-screen"
    >
      {/* 1. Control Toolbar (HUD) */}
      <DigitalTwinHUD
        mode={mode}
        onChangeMode={setMode}
        activeLayer={activeLayer}
        onChangeLayer={setActiveLayer}
        cameraMode={cameraMode}
        onChangeCamera={setCameraMode}
        selectedZone={selectedZone}
        onChangeZone={setSelectedZone}
        onResetCamera={() => {
          setCameraMode('overview');
          setResetKey((k) => k + 1);
        }}
        onToggleFullscreen={handleToggleFullscreen}
        onTriggerVerticalSlice={handleTriggerVerticalSlice}
        isExecutingSlice={isExecutingSlice}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Three.js Interactive 3D Canvas */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <Warehouse3DCanvas
          racks={unifiedModel.racks}
          activeLayer={activeLayer}
          showRoutes={true}
          cameraMode={cameraMode}
          forkliftState={simFrame.forklift}
          agvState={agvFrame}
          carriedPallet={simFrame.pallet.attached ? activeEvent : null}
          selectedSlotKey={selectedItem?.slotKey}
          highlightSlotKey={targetSlotCoords?.slotId}
          targetSlotCoords={targetSlotCoords}
          resetKey={resetKey}
          onSelectSlot={handleSelectSlot}
          onSelectRack={handleSelectRack}
          onSelectForklift={handleSelectForklift}
          onSelectAGV={handleSelectAGV}
        />

        {/* 3. Object Inspector Drawer */}
        <DigitalTwinInspector
          selectedItem={selectedItem}
          onClose={() => setSelectedItem(null)}
          onFocusCamera={() => setCameraMode('slot')}
        />
      </div>

      {/* 4. Playback Timeline & Scrubber */}
      <DigitalTwinTimeline
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        progress={progress}
        onSeek={(val) => {
          setIsPlaying(false);
          setProgress(val);
        }}
        speed={speed}
        onChangeSpeed={setSpeed}
        onReset={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        phaseText={simFrame.phaseText}
        activeEvent={activeEvent}
        eventsList={historicalEvents}
        onSelectEvent={(ev) => {
          setActiveEvent(ev);
          setProgress(0);
          setIsPlaying(true);
        }}
      />
    </div>
  );
}
