export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  method?: string;
  status?: number;
  data?: any;
}

declare global {
  var _systemLogs: SystemLog[];
}

export const systemLogs = globalThis._systemLogs || [];
if (process.env.NODE_ENV !== 'production') {
  globalThis._systemLogs = systemLogs;
}

export function addLog(log: Omit<SystemLog, 'id' | 'timestamp'>) {
  const entry: SystemLog = {
    id: Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    ...log,
  };
  systemLogs.unshift(entry);
  if (systemLogs.length > 500) systemLogs.pop();
  console.log(`[LOG] ${entry.type.toUpperCase()} ${entry.endpoint}`, entry.status || '', entry.data ? JSON.stringify(entry.data).substring(0, 100) : '');
}

export function clearLogs() {
  systemLogs.length = 0;
}
