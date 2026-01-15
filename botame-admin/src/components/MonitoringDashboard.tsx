import { useState, useEffect } from 'react';

interface SystemMetrics {
  cpu: number;
  memory: number;
  uptime: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  errorCount: number;
}

/**
 * Monitoring Dashboard Component
 * Real-time system and service health monitoring
 */
export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    uptime: 0,
  });

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Browser', status: 'healthy', lastCheck: Date.now(), errorCount: 0 },
    { name: 'Supabase', status: 'healthy', lastCheck: Date.now(), errorCount: 0 },
    { name: 'AI Service', status: 'healthy', lastCheck: Date.now(), errorCount: 0 },
  ]);

  useEffect(() => {
    // Update metrics every second
    const interval = setInterval(async () => {
      try {
        const result = await window.electron.invoke('monitoring:getMetrics');
        setMetrics(result);
      } catch (error) {
        console.error('[MonitoringDashboard] Failed to get metrics:', error);
      }
    }, 1000);

    // Update service status every 5 seconds
    const serviceInterval = setInterval(async () => {
      try {
        const result = await window.electron.invoke('monitoring:getServiceStatus');
        setServices(result);
      } catch (error) {
        console.error('[MonitoringDashboard] Failed to get service status:', error);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(serviceInterval);
    };
  }, []);

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">시스템 모니터링</h2>

      {/* System Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">CPU 사용률</div>
          <div className="text-2xl font-bold text-blue-900">{metrics.cpu}%</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600 mb-1">메모리</div>
          <div className="text-2xl font-bold text-purple-900">{metrics.memory}%</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 mb-1">가동 시간</div>
          <div className="text-2xl font-bold text-green-900">{formatUptime(metrics.uptime)}</div>
        </div>
      </div>

      {/* Service Status */}
      <h3 className="text-lg font-semibold mb-3">서비스 상태</h3>
      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
              <span className="font-medium">{service.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>오류: {service.errorCount}</span>
              <span>
                {new Date(service.lastCheck).toLocaleTimeString('ko-KR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
