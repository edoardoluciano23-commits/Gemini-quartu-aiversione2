"use client";

import { useEffect, useState } from "react";
import { Terminal, X, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SystemLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  method?: string;
  status?: number;
  data?: any;
}

export function SystemLogsViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    await fetch("/api/logs", { method: "DELETE" });
    setLogs([]);
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-green-400 font-mono text-[11px] sm:text-xs">
      <div className="flex items-center justify-between border-b border-green-500/30 p-2 sm:p-4 bg-black">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <h2 className="font-bold tracking-wider">SYSTEM LOGS (Network Debugger)</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading} className="text-green-400 hover:text-green-300 hover:bg-green-900/20">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearLogs} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-green-400 hover:text-green-300 hover:bg-green-900/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {logs.length === 0 ? (
          <div className="text-green-600/50 italic">No logs recorded yet. Waiting for API requests...</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="border border-green-500/20 rounded p-3 bg-green-950/10">
              <div className="flex items-start justify-between opacity-70 mb-2">
                <span className="text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${
                  log.type === 'error' ? 'bg-red-500/20 text-red-400' :
                  log.type === 'request' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {log.type} {log.method ? `(${log.method})` : ''} {log.status ? `[${log.status}]` : ''}
                </span>
              </div>
              <div className="break-all text-blue-300 font-semibold mb-2">{log.endpoint}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-green-500/20 pt-2 text-green-300/80">
                {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
