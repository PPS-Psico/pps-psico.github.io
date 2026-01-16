// Academic Analytics Dashboard for UFLO
import React, { useState, useEffect } from 'react';
import { getWebVitalsData, getPerformanceScore } from '../lib/webVitals';
import { trackAcademicEvents, setCustomDimensions } from '../lib/analytics';
import { trackError } from '../lib/sentry';
import Card from './ui/Card';
import MetricCard from './MetricCard';
import { useAuth } from '../contexts/AuthContext';

// Types for dashboard data
interface AcademicMetrics {
  totalStudents: number;
  activePractices: number;
  completionRate: number;
  avgResponseTime: number;
  errorRate: number;
  performanceScore: number;
  userEngagement: number;
  conversionRate: number;
}

interface WebVitalsData {
  CLS?: { value: number; rating: string };
  INP?: { value: number; rating: string };
  FCP?: { value: number; rating: string };
  LCP?: { value: number; rating: string };
  TTFB?: { value: number; rating: string };
}

const AcademicDashboard: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const [metrics, setMetrics] = useState<AcademicMetrics>({
    totalStudents: 0,
    activePractices: 0,
    completionRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    performanceScore: 0,
    userEngagement: 0,
    conversionRate: 0
  });
  
  const [webVitals, setWebVitals] = useState<WebVitalsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [realTimeData, setRealTimeData] = useState({
    activeUsers: 0,
    currentLoad: 0,
    systemHealth: 'good' as 'good' | 'warning' | 'critical'
  });

  // Initialize custom dimensions for analytics
  useEffect(() => {
    if (authenticatedUser) {
      setCustomDimensions({
        role: authenticatedUser.role || 'Student',
        orientation: authenticatedUser.orientaciones?.[0] || 'unknown',
        legajo: authenticatedUser.legajo
      });
    }
  }, [authenticatedUser]);

  // Fetch academic metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API calls to get academic metrics
        const academicData = await fetchAcademicMetrics();
        setMetrics(academicData);
        
        // Get performance data
        const vitalsData = getWebVitalsData();
        setWebVitals(vitalsData);
        
        // Track dashboard view
        trackAcademicEvents.featureUsed('academic_dashboard', authenticatedUser?.role);
        
      } catch (error) {
        console.error('Error fetching academic metrics:', error);
        trackError(error as Error, { context: 'academic_dashboard' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
    
    // Set up real-time updates
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [authenticatedUser]);

  // Fetch real-time data
  useEffect(() => {
    const fetchRealTimeData = () => {
      // Simulate real-time data
      setRealTimeData({
        activeUsers: Math.floor(Math.random() * 100) + 20,
        currentLoad: Math.floor(Math.random() * 80) + 10,
        systemHealth: Math.random() > 0.8 ? 'warning' : 'good'
      });
    };

    fetchRealTimeData();
    const interval = setInterval(fetchRealTimeData, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Mock function to simulate academic metrics API
  const fetchAcademicMetrics = async (): Promise<AcademicMetrics> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totalStudents: 1250,
          activePractices: 342,
          completionRate: 78.5,
          avgResponseTime: 245,
          errorRate: 2.3,
          performanceScore: getPerformanceScore(),
          userEngagement: 85.2,
          conversionRate: 92.1
        });
      }, 1000);
    });
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getVitalsColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs_improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Académico</h1>
          <p className="text-gray-600">Métricas en tiempo real del sistema de PPS</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium ${getHealthColor(realTimeData.systemHealth)}`}>
            Estado del Sistema: {realTimeData.systemHealth === 'good' ? 'Saludable' : 
                              realTimeData.systemHealth === 'warning' ? 'Advertencia' : 'Crítico'}
          </div>
          <div className="text-sm text-gray-600">
            Usuarios Activos: {realTimeData.activeUsers}
          </div>
        </div>
      </div>

      {/* Academic Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Estudiantes Totales"
          value={metrics.totalStudents}
          icon="people"
          description="Total de estudiantes registrados +12% vs mes anterior"
          isLoading={false}
        />
        <MetricCard
          title="Prácticas Activas"
          value={metrics.activePractices}
          icon="work"
          description="Prácticas en curso +5% vs mes anterior"
          isLoading={false}
        />
        <MetricCard
          title="Tasa de Finalización"
          value={`${metrics.completionRate}%`}
          icon="check_circle"
          description="Porcentaje de prácticas completadas +8% vs mes anterior"
          isLoading={false}
        />
        <MetricCard
          title="Tiempo Respuesta"
          value={`${metrics.avgResponseTime}ms`}
          icon="speed"
          description="Tiempo promedio de respuesta del sistema -15% vs mes anterior"
          isLoading={false}
        />
      </div>

      {/* Performance and User Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Métricas de Performance</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Score Performance</span>
              <span className="font-medium">{metrics.performanceScore}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa de Error</span>
              <span className="font-medium text-red-600">{metrics.errorRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Engagement</span>
              <span className="font-medium text-green-600">{metrics.userEngagement}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tasa Conversión</span>
              <span className="font-medium text-blue-600">{metrics.conversionRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Carga del Sistema</span>
              <span className="font-medium">{realTimeData.currentLoad}%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Core Web Vitals</h2>
          <div className="space-y-4">
            {Object.entries(webVitals).map(([name, data]) => (
              <div key={name} className="flex justify-between items-center">
                <span className="text-gray-600">{name}</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {name === 'CLS' ? data.value?.toFixed(3) : 
                     name === 'INP' || name === 'FCP' || name === 'LCP' || name === 'TTFB' 
                     ? Math.round(data.value || 0) + 'ms' : data.value}
                  </span>
                  <span className={`text-sm ${getVitalsColor(data.rating || 'unknown')}`}>
                    {data.rating === 'good' ? '✓' : 
                     data.rating === 'needs_improvement' ? '⚠' : '✗'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Actividad Reciente</h2>
        <div className="space-y-3">
          {[
            'Nuevo estudiante registrado: Juan Pérez (Legajo: 12345)',
            'Práctica completada: Hospital Italiano - 120 horas',
            'Convocatoria lanzada: PPS Psicología Clínica',
            'Informe enviado: María González - Práctica Final',
            'Error del sistema: Timeout en API de estudiantes'
          ].map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 text-sm">
              <span className="text-gray-400">{new Date(Date.now() - index * 60000).toLocaleTimeString()}</span>
              <span className={`flex-1 ${activity.includes('Error') ? 'text-red-600' : 'text-gray-700'}`}>
                {activity}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AcademicDashboard;