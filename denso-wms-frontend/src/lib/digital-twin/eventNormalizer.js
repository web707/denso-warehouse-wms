// eventNormalizer.js
// Normalizes raw WMS transactions and ledger records into standardized Digital Twin Domain Events.

export const DOMAIN_EVENT_TYPES = Object.freeze({
  GOODS_RECEIVED: 'GOODS_RECEIVED',
  PUTAWAY_STARTED: 'PUTAWAY_STARTED',
  PUTAWAY_COMPLETED: 'PUTAWAY_COMPLETED',
  STOCK_RESERVED: 'STOCK_RESERVED',
  PICK_STARTED: 'PICK_STARTED',
  PICK_COMPLETED: 'PICK_COMPLETED',
  GOODS_DISPATCHED: 'GOODS_DISPATCHED',
  STOCK_TRANSFERRED: 'STOCK_TRANSFERRED',
  INVENTORY_COUNTED: 'INVENTORY_COUNTED',
  QC_STATUS_CHANGED: 'QC_STATUS_CHANGED',
  LOT_EXPIRED: 'LOT_EXPIRED'
});

export const EVENT_LABELS = Object.freeze({
  GOODS_RECEIVED: 'Tiếp nhận hàng PO',
  PUTAWAY_STARTED: 'Bắt đầu xếp dỡ (Putaway)',
  PUTAWAY_COMPLETED: 'Hoàn tất cất hàng lên kệ',
  STOCK_RESERVED: 'Giữ tồn xuất kho (Reserved)',
  PICK_STARTED: 'Bắt đầu lấy hàng (Picking)',
  PICK_COMPLETED: 'Đã soạn & chuyển Packing',
  GOODS_DISPATCHED: 'Xuất kho thành công',
  STOCK_TRANSFERRED: 'Điều chuyển nội bộ',
  INVENTORY_COUNTED: 'Kiểm kê thực địa',
  QC_STATUS_CHANGED: 'Cập nhật trạng thái QC',
  LOT_EXPIRED: 'Cảnh báo hạn dùng FEFO'
});

export const EVENT_COLORS = Object.freeze({
  GOODS_RECEIVED: '#38bdf8', // Sky
  PUTAWAY_STARTED: '#fbbf24', // Amber
  PUTAWAY_COMPLETED: '#10b981', // Emerald
  STOCK_RESERVED: '#f59e0b', // Amber/Orange
  PICK_STARTED: '#a855f7', // Purple
  PICK_COMPLETED: '#2dd4bf', // Teal
  GOODS_DISPATCHED: '#3b82f6', // Blue
  STOCK_TRANSFERRED: '#ec4899', // Pink
  INVENTORY_COUNTED: '#64748b', // Slate
  QC_STATUS_CHANGED: '#eab308', // Yellow
  LOT_EXPIRED: '#ef4444' // Red
});

/**
 * Normalizes backend transactions into sequential simulation domain events.
 */
export function normalizeTransactionsToEvents(transactions = [], partsMap = new Map(), racksMap = new Map()) {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  return transactions.map((tx, idx) => {
    const part = partsMap.get(tx.part_id || tx.partId);
    const fromRack = racksMap.get(tx.from_rack_id || tx.fromRackId);
    const toRack = racksMap.get(tx.to_rack_id || tx.toRackId) || (part ? racksMap.get(part.rackId) : null);

    let type = DOMAIN_EVENT_TYPES.PUTAWAY_COMPLETED;
    if (tx.type === 'inbound') type = DOMAIN_EVENT_TYPES.PUTAWAY_COMPLETED;
    else if (tx.type === 'outbound') type = DOMAIN_EVENT_TYPES.GOODS_DISPATCHED;
    else if (tx.type === 'transfer') type = DOMAIN_EVENT_TYPES.STOCK_TRANSFERRED;
    else if (tx.type === 'adjustment') type = DOMAIN_EVENT_TYPES.INVENTORY_COUNTED;

    const slotIndex = part?.preferredRackSlot ?? 0;
    const slotCode = `S${String(slotIndex + 1).padStart(2, '0')}`;
    const targetRackName = toRack?.name || 'R01';

    return {
      id: tx.id || `TX-${idx + 1}`,
      rawType: tx.type,
      type,
      label: EVENT_LABELS[type] || tx.type,
      color: EVENT_COLORS[type] || '#10b981',
      timestamp: tx.created_at || tx.createdAt || new Date().toISOString(),
      quantity: tx.quantity_pcs || tx.quantityPcs || part?.quantityPcs || 100,
      sku: part?.productCode || part?.product_code || 'MSN-CHINSU-CHILI-250',
      partName: part?.partName || 'Hàng hóa Masan',
      lotNumber: part?.lotNumber || tx.lot_number || 'LÔ-GỐC',
      partId: tx.part_id || tx.partId,
      source: {
        rackName: fromRack?.name || (tx.type === 'inbound' ? 'DOCK-IN' : targetRackName),
        slotCode: fromRack ? slotCode : 'DOCK-01',
        zone: fromRack?.zoneCode || 'ZONE-A'
      },
      destination: {
        rackName: targetRackName,
        slotCode: slotCode,
        zone: toRack?.zoneCode || 'ZONE-A'
      },
      status: 'CONFIRMED_BACKEND',
      isReplayCandidate: true
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Normalizes receiving receipt line into an inbound simulation sequence.
 */
export function normalizeReceiptToEventSequence(receipt, parts = [], racksMap = new Map()) {
  if (!receipt) return [];
  const primaryPart = parts[0] || {};
  const toRack = racksMap.get(primaryPart.rack) || { name: 'R01', zoneCode: 'ZONE-A' };
  const slotIdx = primaryPart.preferred_rack_slot ?? 0;
  const slotCode = `S${String(slotIdx + 1).padStart(2, '0')}`;

  const baseTime = new Date(receipt.created_at || Date.now()).getTime();

  return [
    {
      id: `${receipt.id}-RECV`,
      type: DOMAIN_EVENT_TYPES.GOODS_RECEIVED,
      label: EVENT_LABELS.GOODS_RECEIVED,
      color: EVENT_COLORS.GOODS_RECEIVED,
      timestamp: new Date(baseTime).toISOString(),
      quantity: receipt.received_quantity_pcs || 100,
      sku: receipt.product_code || 'MSN-CHINSU-CHILI-250',
      lotNumber: primaryPart.lot_number || 'LOT-INBOUND',
      partId: primaryPart.id,
      source: { rackName: 'TRUCK-IN', slotCode: 'INBOUND-BAY', zone: 'EXT-DOCK' },
      destination: { rackName: 'DOCK-RECEIVING', slotCode: 'STAGE-01', zone: 'ZONE-A' },
      status: 'CONFIRMED'
    },
    {
      id: `${receipt.id}-PUTAWAY-START`,
      type: DOMAIN_EVENT_TYPES.PUTAWAY_STARTED,
      label: EVENT_LABELS.PUTAWAY_STARTED,
      color: EVENT_COLORS.PUTAWAY_STARTED,
      timestamp: new Date(baseTime + 120000).toISOString(),
      quantity: receipt.received_quantity_pcs || 100,
      sku: receipt.product_code || 'MSN-CHINSU-CHILI-250',
      lotNumber: primaryPart.lot_number || 'LOT-INBOUND',
      partId: primaryPart.id,
      source: { rackName: 'DOCK-RECEIVING', slotCode: 'STAGE-01', zone: 'ZONE-A' },
      destination: { rackName: toRack.name, slotCode, zone: toRack.zoneCode },
      status: 'SIMULATED_TRANSIT'
    },
    {
      id: `${receipt.id}-PUTAWAY-DONE`,
      type: DOMAIN_EVENT_TYPES.PUTAWAY_COMPLETED,
      label: EVENT_LABELS.PUTAWAY_COMPLETED,
      color: EVENT_COLORS.PUTAWAY_COMPLETED,
      timestamp: new Date(baseTime + 300000).toISOString(),
      quantity: receipt.received_quantity_pcs || 100,
      sku: receipt.product_code || 'MSN-CHINSU-CHILI-250',
      lotNumber: primaryPart.lot_number || 'LOT-INBOUND',
      partId: primaryPart.id,
      source: { rackName: 'DOCK-RECEIVING', slotCode: 'STAGE-01', zone: 'ZONE-A' },
      destination: { rackName: toRack.name, slotCode, zone: toRack.zoneCode },
      status: 'CONFIRMED'
    }
  ];
}
