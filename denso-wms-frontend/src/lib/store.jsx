import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/api';

const StoreContext = createContext(null);

function toParts(rawParts) {
  return rawParts.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    partName: p.partName,
    productCode: p.productCode || '',
    masterPo: p.masterPo,
    dcPrefix: p.dcPrefix?.code || '',
    poNumber: '',
    divisionCode: p.division?.code || '',
    quantity: p.quantityPcs,
    weight: Number(p.totalWeightKg),
    cartons: p.cartonCount,
    cartonLength: p.cartonLengthMm / 10,
    cartonWidth: p.cartonWidthMm / 10,
    cartonHeight: p.cartonHeightMm / 10,
    rackId: p.rackId,
    preferredRackSlot: p.preferredRackSlot,
    color: p.colorHex,
    lotNumber: p.lotNumber || '',
    storageClass: p.storageClass || 'unknown',
    uomCode: p.uomCode || 'EA',
    unitCost: p.unitCost === null || p.unitCost === undefined ? '' : Number(p.unitCost),
    expirationDate: p.expirationDate ? String(p.expirationDate).slice(0, 10) : '',
    supplierName: p.supplierName || '',
    supplierId: p.supplierId ?? '',
    supplierSiteCode: p.supplierSiteCode || '',
  }));
}

function toRacks(rawRacks) {
  return rawRacks.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    name: r.name,
    warehouseCode: r.warehouseCode || 'DENSO-WH',
    zoneCode: r.zoneCode || 'ZONE-A',
    productFamily: r.productFamily || null,
    type: r.rackType?.code,
    rackTypeId: r.rackType?.id,
    maxCbm: Number(r.maxCbmOverride ?? r.rackType?.maxCbm ?? 0),
    maxWeight: Number(r.maxPayloadKgOverride ?? r.rackType?.maxPayloadKg ?? 0),
  }));
}

function toRules(rawRules) {
  return rawRules.map((r) => ({
    id: r.id,
    icon: r.icon,
    text: r.text,
    category: r.category,
    active: r.active,
    isSystem: r.isSystem,
  }));
}

function getSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSessionCache(key, val) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function StoreProvider({ children }) {
  const [orders, setOrders] = useState(() => getSessionCache('ms_orders') || []);
  const [parts, setParts] = useState(() => getSessionCache('ms_parts') || []);
  const [racks, setRacks] = useState(() => getSessionCache('ms_racks') || []);
  const [packingRules, setPackingRules] = useState(() => getSessionCache('ms_rules') || []);
  const [history, setHistory] = useState(() => getSessionCache('ms_hist') || []);
  const [divisions, setDivisions] = useState(() => getSessionCache('ms_divs') || []);
  const [rackTypes, setRackTypes] = useState(() => getSessionCache('ms_types') || []);
  const [isLoading, setIsLoading] = useState(() => !getSessionCache('ms_orders'));
  const [currentOrderId, setCurrentOrderIdState] = useState(() => localStorage.getItem('currentOrderId') || null);

  const setCurrentOrderId = useCallback((id) => {
    setCurrentOrderIdState(id);
    if (id) localStorage.setItem('currentOrderId', id);
    else localStorage.removeItem('currentOrderId');
  }, []);

  const refetchOrders = useCallback(() => api.orders.list().then((d) => { setOrders(d); setSessionCache('ms_orders', d); return d; }), []);
  const refetchParts = useCallback(() => api.parts.list().then((d) => { const p = toParts(d); setParts(p); setSessionCache('ms_parts', p); return p; }), []);
  const refetchRacks = useCallback(() => api.racks.list().then((d) => { const r = toRacks(d); setRacks(r); setSessionCache('ms_racks', r); return r; }), []);
  const refetchRules = useCallback(() => api.packingRules.list().then((d) => { const r = toRules(d); setPackingRules(r); setSessionCache('ms_rules', r); return r; }), []);
  const refetchHistory = useCallback(() => api.history.list({ pageSize: 50 }).then((res) => { const h = res.items || []; setHistory(h); setSessionCache('ms_hist', h); return h; }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getSessionCache('ms_orders')) {
        setIsLoading(true);
      }
      try {
        await Promise.all([
          api.divisions.list().then((d) => { if (!cancelled) { setDivisions(d); setSessionCache('ms_divs', d); } }),
          api.rackTypes.list().then((t) => { if (!cancelled) { setRackTypes(t); setSessionCache('ms_types', t); } }),
          refetchOrders(),
          refetchParts(),
          refetchRacks(),
          refetchRules(),
          refetchHistory(),
        ]);
      } catch (err) {
        console.warn('Initial store sync notice:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refetchOrders, refetchParts, refetchRacks, refetchRules, refetchHistory]);

  function resolveDivisionAndPrefix(divisionCode, dcPrefixCode) {
    const division = divisions.find((d) => d.code === String(divisionCode || '').trim().toUpperCase());
    if (!division) throw new Error(divisionCode ? `Division \"${divisionCode}\" không tồn tại` : 'Bạn chưa chọn Division. Hãy chọn Division trước khi lưu PART.');
    const wantedPrefix = String(dcPrefixCode || '').trim().padStart(2, '0');
    const prefix = (division.dcPrefixes || []).find((p) => p.code === wantedPrefix);
    if (!prefix) throw new Error(`DC Prefix "${dcPrefixCode}" không thuộc Division "${divisionCode}"`);
    return { divisionId: division.id, dcPrefixId: prefix.id };
  }

  const addOrder = useCallback(async (data) => {
    const order = await api.orders.create({
      orderNumber: data.orderNumber,
      name: data.name || undefined,
      division: data.division,
      destination: data.destination || 'WAREHOUSE',
    });
    await Promise.all([refetchOrders(), refetchHistory()]);
    return order;
  }, [refetchOrders, refetchHistory]);

  const updateOrder = useCallback(async (id, data) => {
    await api.orders.update(id, data);
    await Promise.all([refetchOrders(), refetchHistory()]);
  }, [refetchOrders, refetchHistory]);

  const renameOrder = useCallback((id, name) => updateOrder(id, { name }), [updateOrder]);

  const deleteOrder = useCallback(async (id) => {
    await api.orders.remove(id);
    await Promise.all([refetchOrders(), refetchParts(), refetchRacks(), refetchHistory()]);
  }, [refetchOrders, refetchParts, refetchRacks, refetchHistory]);

  function toCreatePartBody(data) {
    const { divisionId, dcPrefixId } = resolveDivisionAndPrefix(data.divisionCode, data.dcPrefix);
    return {
      orderId: data.orderId,
      rackId: data.rackId || undefined,
      partName: data.partName,
      productCode: data.productCode || undefined,
      divisionId,
      dcPrefixId,
      masterPo: data.masterPo,
      quantityPcs: +data.quantity || 0,
      totalWeightKg: +data.weight || 0,
      cartonCount: +data.cartons || 0,
      cartonLengthMm: Math.round((+data.cartonLength || 0) * 10),
      cartonWidthMm: Math.round((+data.cartonWidth || 0) * 10),
      cartonHeightMm: Math.round((+data.cartonHeight || 0) * 10),
      lotNumber: data.lotNumber || null,
      storageClass: data.storageClass || 'unknown',
      uomCode: data.uomCode || 'EA',
      unitCost: data.unitCost === '' || data.unitCost === undefined || data.unitCost === null ? null : +data.unitCost,
      expirationDate: data.expirationDate || null,
      supplierName: data.supplierName || null,
      supplierId: data.supplierId === '' || data.supplierId === undefined || data.supplierId === null ? null : Math.round(+data.supplierId),
      supplierSiteCode: data.supplierSiteCode || null,
    };
  }

  const addPart = useCallback(async (data) => {
    const created = await api.parts.create(toCreatePartBody(data));
    await Promise.all([refetchParts(), refetchHistory()]);
    try { window.dispatchEvent(new CustomEvent('wms-inventory-committed', { detail: { rackIds: [data.rackId].filter(Boolean) } })); } catch { /* SSR */ }
    return created;
  }, [divisions, refetchParts, refetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveRacks = useCallback(async (rackIds) => {
    const ids = [...new Set(rackIds.filter(Boolean))];
    await Promise.all(ids.map((id) => api.storage.solve(id).catch(() => {})));
  }, []);

  const updatePart = useCallback(async (id, data) => {
    const previous = parts.find((p) => p.id === id);
    await api.parts.update(id, toCreatePartBody({
      ...data,
      divisionCode: data.divisionCode || previous?.divisionCode,
      dcPrefix: data.dcPrefix || previous?.dcPrefix,
    }));
    await resolveRacks([previous?.rackId, data.rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [divisions, parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const deletePart = useCallback(async (id) => {
    const previous = parts.find((p) => p.id === id);
    await api.parts.remove(id);
    await resolveRacks([previous?.rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]);

  const assignPart = useCallback(async (partId, rackId, slotIndex = null) => {
    const previous = parts.find((p) => p.id === partId);
    await api.parts.assignRack(partId, rackId || null, slotIndex);
    await resolveRacks([previous?.rackId, rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]);

  const createRackForOrder = useCallback(async (orderId, { rackTypeId, name, warehouseCode, zoneCode, maxCbm, maxWeight }) => {
    const rack = await api.racks.create({
      orderId,
      rackTypeId,
      name,
      warehouseCode: warehouseCode || 'DENSO-WH',
      zoneCode: zoneCode || 'ZONE-A',
      maxCbmOverride: maxCbm || undefined,
      maxPayloadKgOverride: maxWeight || undefined,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
    return rack;
  }, [refetchRacks, refetchHistory]);

  const initializeWarehouse = useCallback(async ({ orderId, warehouseCode = 'DENSO-WH', zoneCode = 'ZONE-A', rackCount = 20, rackTypeId }) => {
    const result = await api.racks.initializeWarehouse({
      orderId,
      warehouseCode,
      zoneCode,
      rackCount,
      rackTypeId,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
    return result;
  }, [refetchRacks, refetchHistory]);

  const autoAssignRack = useCallback(async (rackId) => {
    const assignResult = await api.storage.autoAssign(rackId);
    const plan = await api.storage.solve(rackId);
    await Promise.all([refetchParts(), refetchRacks(), refetchOrders(), refetchHistory()]);
    return { ...assignResult, violations: plan.violations };
  }, [refetchParts, refetchRacks, refetchOrders, refetchHistory]);

  const updateRack = useCallback(async (id, data) => {
    await api.racks.update(id, {
      name: data.name,
      rackTypeId: data.rackTypeId,
      warehouseCode: data.warehouseCode,
      zoneCode: data.zoneCode,
      productFamily: data.productFamily,
      maxCbmOverride: data.maxCbm,
      maxPayloadKgOverride: data.maxWeight,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
  }, [refetchRacks, refetchHistory]);

  const deleteRack = useCallback(async (id) => {
    await api.racks.remove(id);
    await Promise.all([refetchRacks(), refetchParts(), refetchHistory()]);
  }, [refetchRacks, refetchParts, refetchHistory]);

  const addRule = useCallback(async (data) => {
    await api.packingRules.create(data);
    await Promise.all([refetchRules(), refetchHistory()]);
  }, [refetchRules, refetchHistory]);
  const updateRule = useCallback(async (id, data) => { await api.packingRules.update(id, data); await refetchRules(); }, [refetchRules]);
  const deleteRule = useCallback(async (id) => { await api.packingRules.remove(id); await Promise.all([refetchRules(), refetchHistory()]); }, [refetchRules, refetchHistory]);
  const activeRules = packingRules.filter((r) => r.active !== false);
  const logExport = useCallback(() => { refetchHistory(); }, [refetchHistory]);
  // Apply server-confirmed stock directly: 3D racks subscribe to this shared state.
  const applyInventorySnapshot = useCallback((snapshot) => {
    if (!snapshot?.id) return;
    setParts((current) => current.map((p) => p.id === snapshot.id ? {
      ...p,
      quantity: snapshot.quantityPcs,
      cartons: snapshot.cartonCount,
      weight: Number(snapshot.totalWeightKg),
      rackId: snapshot.rackId,
      preferredRackSlot: snapshot.preferredRackSlot,
    } : p));
  }, []);

  // Keep other open tabs consistent; event is fired only after the server commits.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'wms_inventory_committed') refetchParts().catch(console.error);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refetchParts]);

  const resetData = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchParts(), refetchRacks(), refetchRules(), refetchHistory()]);
  }, [refetchOrders, refetchParts, refetchRacks, refetchRules, refetchHistory]);

  const value = {
    orders, parts, racks, packingRules, history, rackTypes, divisions, activeRules, isLoading,
    currentOrderId, setCurrentOrderId,
    addOrder, updateOrder, renameOrder, deleteOrder,
    addPart, updatePart, deletePart, assignPart,
    createRackForOrder, initializeWarehouse, autoAssignRack, updateRack, deleteRack,
    addRule, updateRule, deleteRule, logExport, resetData, applyInventorySnapshot, refetchParts,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
