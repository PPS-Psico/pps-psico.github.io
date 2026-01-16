// Health Check and Monitoring Endpoints
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { trackError, trackPerformance } from '../lib/sentry';

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    database: boolean;
    supabaseAuth: boolean;
    cache: boolean;
    api: boolean;
    storage: boolean;
  };
  lastCheck: Date;
  uptime: number;
  version: string;
}

interface SystemMetrics {
  activeUsers: number;
  requestCount: number;
  errorRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Hook for health monitoring
export const useHealthMonitor = () => {
  const [health, setHealth] = useState<HealthStatus>({
    status: 'healthy',
    checks: {
      database: false,
      supabaseAuth: false,
      cache: false,
      api: false,
      storage: false
    },
    lastCheck: new Date(),
    uptime: 0,
    version: '1.0.0'
  });

  const [metrics, setMetrics] = useState<SystemMetrics>({
    activeUsers: 0,
    requestCount: 0,
    errorRate: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
    cpuUsage: 0
  });

  const [isMonitoring, setIsMonitoring] = useState(false);

  // Check database health
  const checkDatabaseHealth = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();
      const { error } = await supabase
        .from('estudiantes')
        .select('count(*)', { count: 'exact', head: true })
        .limit(1);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      trackPerformance('database_health_check', responseTime, { 
        success: !error,
        responseTime 
      });
      
      return !error && responseTime < 2000; // 2 seconds threshold
    } catch (error) {
      trackError(error as Error, { context: 'database_health_check' });
      return false;
    }
  };

  // Check Supabase Auth health
  const checkSupabaseAuthHealth = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();
      await supabase.auth.getSession();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      trackPerformance('supabase_auth_health_check', responseTime, {
        success: true,
        responseTime
      });
      
      return responseTime < 1000; // 1 second threshold
    } catch (error) {
      trackError(error as Error, { context: 'supabase_auth_health_check' });
      return false;
    }
  };

  // Check API health
  const checkAPIHealth = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();
      const response = await fetch('/health', {
        method: 'GET',
        cache: 'no-cache'
      });
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      trackPerformance('api_health_check', responseTime, {
        success: response.ok,
        status: response.status,
        responseTime
      });
      
      return response.ok && responseTime < 1000;
    } catch (error) {
      trackError(error as Error, { context: 'api_health_check' });
      return false;
    }
  };

  // Check browser cache health
  const checkCacheHealth = (): boolean => {
    try {
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      // Test localStorage
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      trackError(error as Error, { context: 'cache_health_check' });
      return false;
    }
  };

  // Check storage health (localStorage/sessionStorage)
  const checkStorageHealth = (): boolean => {
    try {
      const testData = { test: 'health_check', timestamp: Date.now() };
      localStorage.setItem('health_test', JSON.stringify(testData));
      const retrieved = JSON.parse(localStorage.getItem('health_test') || '{}');
      localStorage.removeItem('health_test');
      
      return retrieved.test === testData.test;
    } catch (error) {
      trackError(error as Error, { context: 'storage_health_check' });
      return false;
    }
  };

  // Run comprehensive health check
  const runHealthCheck = async () => {
    const startTime = performance.now();
    
    try {
      const [
        databaseOk,
        authOk,
        apiOk,
        cacheOk,
        storageOk
      ] = await Promise.all([
        checkDatabaseHealth(),
        checkSupabaseAuthHealth(),
        checkAPIHealth(),
        Promise.resolve(checkCacheHealth()),
        Promise.resolve(checkStorageHealth())
      ]);

      const endTime = performance.now();
      const totalResponseTime = endTime - startTime;
      
      trackPerformance('full_health_check', totalResponseTime, {
        database: databaseOk,
        auth: authOk,
        api: apiOk,
        cache: cacheOk,
        storage: storageOk
      });

      const checks = {
        database: databaseOk,
        supabaseAuth: authOk,
        cache: cacheOk,
        api: apiOk,
        storage: storageOk
      };

      const failedChecks = Object.values(checks).filter(value => !value).length;
      let status: 'healthy' | 'warning' | 'critical';

      if (failedChecks === 0) {
        status = 'healthy';
      } else if (failedChecks <= 2) {
        status = 'warning';
      } else {
        status = 'critical';
      }

      setHealth({
        status,
        checks,
        lastCheck: new Date(),
        uptime: performance.now() / 1000, // Convert to seconds
        version: '1.0.0'
      });

      return { status, checks, responseTime: totalResponseTime };
    } catch (error) {
      trackError(error as Error, { context: 'run_health_check' });
      
      setHealth(prev => ({
        ...prev,
        status: 'critical',
        lastCheck: new Date()
      }));
      
      return { status: 'critical', checks: {}, responseTime: 0 };
    }
  };

  // Collect system metrics
  const collectMetrics = async () => {
    try {
      const memoryData = (performance as any).memory;

      setMetrics({
        activeUsers: Math.floor(Math.random() * 100) + 20, // Mock data
        requestCount: Math.floor(Math.random() * 1000) + 500, // Mock data
        errorRate: Math.random() * 5, // Mock data
        avgResponseTime: Math.random() * 500 + 100, // Mock data
        memoryUsage: memoryData ? (memoryData.usedJSHeapSize / memoryData.totalJSHeapSize) * 100 : 0,
        cpuUsage: Math.random() * 80 // Mock data
      });
    } catch (error) {
      trackError(error as Error, { context: 'collect_metrics' });
    }
  };

  // Start monitoring
  const startMonitoring = () => {
    setIsMonitoring(true);
    
    // Initial health check
    runHealthCheck();
    collectMetrics();
    
    // Set up intervals
    const healthInterval = setInterval(runHealthCheck, 30000); // Every 30 seconds
    const metricsInterval = setInterval(collectMetrics, 10000); // Every 10 seconds
    
    return () => {
      clearInterval(healthInterval);
      clearInterval(metricsInterval);
    };
  };

  // Stop monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  };

  return {
    health,
    metrics,
    isMonitoring,
    runHealthCheck,
    startMonitoring,
    stopMonitoring,
    getStatusColor,
    getStatusIcon
  };
};

// Health Check Component
export const HealthCheckDisplay: React.FC = () => {
  const { health, metrics, startMonitoring, stopMonitoring, getStatusColor, getStatusIcon } = useHealthMonitor();

  useEffect(() => {
    startMonitoring();
    return stopMonitoring;
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Estado del Sistema</h3>
        <div className="flex items-center space-x-2">
          <span className={getStatusColor(health.status)}>
            {getStatusIcon(health.status)}
          </span>
          <span className={`font-medium ${getStatusColor(health.status)}`}>
            {health.status === 'healthy' ? 'Saludable' : 
             health.status === 'warning' ? 'Advertencia' : 'Crítico'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {Object.entries(health.checks).map(([key, value]) => (
          <div key={key} className="flex items-center space-x-2">
            <span>{value ? '✅' : '❌'}</span>
            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t text-xs text-gray-500">
        <div>Última verificación: {health.lastCheck.toLocaleTimeString()}</div>
        <div>Uptime: {Math.floor(health.uptime)}s</div>
        <div>Versión: {health.version}</div>
        <div>Memoria: {metrics.memoryUsage.toFixed(1)}%</div>
      </div>
    </div>
  );
};