export const isDemoMode = import.meta.env.MODE === 'demo';
export const environmentKey = key => isDemoMode ? `wms-demo:${key}` : key;
