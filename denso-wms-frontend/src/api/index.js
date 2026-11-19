import { request, raw } from './client';
import { createInventoryTransaction } from './inventory';

export const api = {
  auth: {
    login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    me: () => request('/auth/me'),
    users: () => request('/auth/users'),
    getUser: (id) => request(`/auth/users/${id}`),
    createUser: (body) => request('/auth/users', { method: 'POST', body }),
    updateUser: (id, body) => request(`/auth/users/${id}`, { method: 'PATCH', body }),
    resetPassword: (id, body) => request(`/auth/users/${id}/reset-password`, { method: 'POST', body }),
    revokeSessions: (id) => request(`/auth/users/${id}/revoke-sessions`, { method: 'POST' }),
    changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
    auditLogs: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/auth/audit-logs${qs ? `?${qs}` : ''}`);
    },
    rolesMetadata: () => request('/auth/roles-metadata'),
  },
  divisions: { list: () => request('/divisions') },
  rackTypes: { list: () => request('/rack-types') },

  orders: {
    list: () => request('/orders'),
    create: (body) => request('/orders', { method: 'POST', body }),
    update: (id, body) => request(`/orders/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
  },

  parts: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/parts${qs ? `?${qs}` : ''}`);
    },
    dashboardSummary: async () => {
      try {
        return await request('/parts/dashboard-summary');
      } catch {
        return null;
      }
    },
    create: (body) => request('/parts', { method: 'POST', body }),
    update: (id, body) => request(`/parts/${id}`, { method: 'PATCH', body }),
    assignRack: (id, rackId, slotIndex = null) =>
      request(`/parts/${id}/rack-assignment`, { method: 'PATCH', body: { rackId, slotIndex } }),
    remove: (id) => request(`/parts/${id}`, { method: 'DELETE' }),
  },

  racks: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/racks${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/racks', { method: 'POST', body }),
    initializeWarehouse: (body) => request('/racks/initialize-warehouse', { method: 'POST', body }),
    update: (id, body) => request(`/racks/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/racks/${id}`, { method: 'DELETE' }),
  },

  packingRules: {
    list: () => request('/packing-rules'),
    create: (body) => request('/packing-rules', { method: 'POST', body }),
    update: (id, body) => request(`/packing-rules/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/packing-rules/${id}`, { method: 'DELETE' }),
  },

  history: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/history${qs ? `?${qs}` : ''}`);
    },
  },

  storage: {
    solve: (rackId) => request(`/storage/racks/${rackId}/solve`, { method: 'POST' }),
    autoAssign: (rackId) => request(`/storage/racks/${rackId}/auto-assign`, { method: 'POST' }),
    plan: (rackId) => request(`/storage/racks/${rackId}/plan`),
    violations: (rackId) => request(`/storage/racks/${rackId}/violations`),
    recommendRack: (orderId) => request(`/storage/orders/${orderId}/recommend-rack`),
    exportXlsx: (rackId) => raw(`/storage/racks/${rackId}/export.xlsx`),
    exportOrderXlsx: (orderId) => raw(`/storage/orders/${orderId}/export.xlsx`),
  },


  inventory: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/inventory/transactions${qs ? `?${qs}` : ''}`); },
    create: createInventoryTransaction,
    transactionSummary: async (days = 30, zoneCode) => {
      try {
        const qs = new URLSearchParams({ days });
        if (zoneCode) qs.set('zoneCode', zoneCode);
        const res = await request(`/inventory/transaction-summary?${qs}`);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {}
      try {
        const txs = await request('/inventory/transactions?limit=200');
        const items = Array.isArray(txs) ? txs : (txs?.items || []);
        const dateMap = new Map();
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          dateMap.set(dateStr, { date: dateStr, inbound: 0, outbound: 0, transfer: 0 });
        }
        for (const tx of items) {
          const dateStr = String(tx.createdAt || tx.timestamp || '').slice(0, 10);
          if (dateMap.has(dateStr)) {
            const entry = dateMap.get(dateStr);
            const qty = Number(tx.quantityPcs) || 1;
            if (tx.type === 'inbound') entry.inbound += qty;
            else if (tx.type === 'outbound') entry.outbound += qty;
            else if (tx.type === 'transfer') entry.transfer += qty;
          }
        }
        return Array.from(dateMap.values());
      } catch {
        return [];
      }
    },
    heatmap: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/inventory/heatmap${qs ? `?${qs}` : ''}`); },
  },

  workOrders: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/work-orders${qs ? `?${qs}` : ''}`); },
    create: (body) => request('/work-orders', { method: 'POST', body }),
    update: (id, body) => request(`/work-orders/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/work-orders/${id}`, { method: 'DELETE' }),
  },

  inspections: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/inspections${qs ? `?${qs}` : ''}`); },
    lotStatus: () => request('/inspections/lot-status'),
    create: (body) => request('/inspections', { method: 'POST', body }),
    update: (id, body) => request(`/inspections/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/inspections/${id}`, { method: 'DELETE' }),
  },

  shipments: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/shipments${qs ? `?${qs}` : ''}`); },
    create: (body) => request('/shipments', { method: 'POST', body }),
    // Định dạng JSON của Oracle (16 trường Khâu 5) và EDI cho khách hàng
    oracleList: () => request('/shipments/oracle'),
    oracleOne: (id) => request(`/shipments/${id}/oracle`),
    oracleCreate: (body) => request('/shipments/oracle', { method: 'POST', body }),
    ediText: (id, standard) => raw(`/shipments/${id}/edi?standard=${standard}`),
    update: (id, body) => request(`/shipments/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/shipments/${id}`, { method: 'DELETE' }),
  },

  zones: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/warehouse-zones${qs ? `?${qs}` : ''}`); },
    create: (body) => request('/warehouse-zones', { method: 'POST', body }),
    update: (id, body) => request(`/warehouse-zones/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/warehouse-zones/${id}`, { method: 'DELETE' }),
  },

  receiving: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/receiving${qs ? `?${qs}` : ''}`);
    },
    summary: () => request('/receiving/summary'),
    create: (body, key) => request('/receiving', { method: 'POST', body, headers: { 'Idempotency-Key': key } }),
    get: (id) => request(`/receiving/${id}`),
    approve: (id, body = {}) => request(`/receiving/${id}/approve`, { method: 'POST', body }),
  },

  imports: {
    template: () => raw('/imports/template'),
    upload: (file, dryRun, targetOrderId, targetRackId) => {
      const form = new FormData();
      form.append('file', file);
      const qs = new URLSearchParams({ dryRun: String(dryRun) });
      if (targetOrderId) qs.set('targetOrderId', targetOrderId);
      if (targetRackId) qs.set('targetRackId', targetRackId);
      return request(`/imports/xlsx?${qs}`, { method: 'POST', body: form });
    },
  },
};
