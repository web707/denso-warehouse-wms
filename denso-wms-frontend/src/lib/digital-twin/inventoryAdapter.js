// inventoryAdapter.js
// Adapter for WMS Backend: Racks, Parts, Lots, QC, Receipts, Dispatches, and Ledger Transactions.
import { request } from '@/api/client';

export async function fetchWarehouseRacks() {
  try {
    const data = await request('/racks');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch racks from API, using default layout:', err);
    return [
      { id: 'R01', name: 'R01', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' },
      { id: 'R02', name: 'R02', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' },
      { id: 'R03', name: 'R03', zoneCode: 'ZONE-A', warehouseCode: 'DENSO-WH' },
      { id: 'R04', name: 'R04', zoneCode: 'ZONE-B', warehouseCode: 'DENSO-WH' },
      { id: 'R05', name: 'R05', zoneCode: 'ZONE-B', warehouseCode: 'DENSO-WH' },
      { id: 'R06', name: 'R06', zoneCode: 'ZONE-B', warehouseCode: 'DENSO-WH' }
    ];
  }
}

export async function fetchWarehouseParts() {
  try {
    const data = await request('/parts?limit=500');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch parts:', err);
    return [];
  }
}

export async function fetchQualityStatuses() {
  try {
    const data = await request('/inspections/lot-status');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch quality statuses:', err);
    return [];
  }
}

export async function fetchReceivingReceipts() {
  try {
    const data = await request('/receiving?limit=50');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch receipts:', err);
    return [];
  }
}

export async function fetchDispatchOrders() {
  try {
    const data = await request('/inventory/dispatches');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch dispatches:', err);
    return [];
  }
}

export async function fetchTransactions() {
  try {
    const data = await request('/inventory/transactions?limit=100');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Failed to fetch transactions:', err);
    return [];
  }
}

export async function fetchJourneyReceiptDetail(receiptId) {
  if (!receiptId) return null;
  try {
    return await request(`/supply-chain/receipt/${receiptId}`);
  } catch (err) {
    console.warn('Failed to fetch receipt detail:', err);
    return null;
  }
}

export async function fetchJourneyDispatchDetail(dispatchId) {
  if (!dispatchId) return null;
  try {
    return await request(`/supply-chain/dispatch/${dispatchId}`);
  } catch (err) {
    console.warn('Failed to fetch dispatch detail:', err);
    return null;
  }
}
