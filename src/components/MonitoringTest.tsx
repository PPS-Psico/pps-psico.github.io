// Testing Component for Monitoring and Analytics
import React, { useState, useEffect } from 'react';
import { trackError, trackMessage } from '../lib/sentry';
import { trackAcademicEvents } from '../lib/analytics';
import { getWebVitalsData, measurePerformance, monitorAPICall } from '../lib/webVitals';
import { useHealthMonitor } from '../lib/healthCheck';
import Card from './ui/Card';

const MonitoringTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);
  const { health, runHealthCheck } = useHealthMonitor();

  // Test functions
  const testErrorTracking = () => {
    try {
      throw new Error('Error de prueba para Sentry');
    } catch (error) {
      trackError(error as Error, {
        component: 'MonitoringTest',
        action: 'testErrorTracking',
        testMode: true
      });
      setTestResults((prev: any) => ({ ...prev, errorTracking: '✅ Error enviado a Sentry' }));
    }
  };

  const testAnalytics = () => {
    trackAcademicEvents.studentRegistration({
      legajo: 'TEST-001',
      orientation: 'Psicología Clínica'
    });

    trackAcademicEvents.practiceSubmission({
      hours: 120,
      institution: 'Hospital de Prueba',
      type: 'Clínica'
    });

    trackAcademicEvents.featureUsed('monitoring_test', 'test_component');

    setTestResults((prev: any) => ({ ...prev, analytics: '✅ Eventos enviados a GA4' }));
  };

  const testPerformance = async () => {
    const result = await measurePerformance('test_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'Operación completada';
    });

    setTestResults((prev: any) => ({ 
      ...prev, 
      performance: `✅ Performance medido: ${result}ms` 
    }));
  };

  const testAPI = async () => {
    try {
      await monitorAPICall(async () => {
        const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
        return response.json();
      }, 'test_api_call');

      setTestResults((prev: any) => ({ 
        ...prev, 
        api: '✅ API call monitoreado exitosamente' 
      }));
    } catch (error) {
      trackError(error as Error, { context: 'test_api_call' });
      setTestResults((prev: any) => ({ 
        ...prev, 
        api: '❌ Error en API call (registrado)' 
      }));
    }
  };

  const testWebVitals = () => {
    const vitals = getWebVitalsData();
    
    setTestResults((prev: any) => ({
      ...prev,
      webVitals: {
        status: '✅ Web Vitals obtenidos',
        data: vitals
      }
    }));
  };

  const testHealthChecks = async () => {
    const result = await runHealthCheck();
    
    setTestResults((prev: any) => ({
      ...prev,
      health: {
        status: '✅ Health checks ejecutados',
        result: result
      }
    }));
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    
    // Run tests with delays
    testErrorTracking();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testAnalytics();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testPerformance();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testAPI();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testWebVitals();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testHealthChecks();
    
    setIsRunning(false);
  };

  // Check browser console for monitoring output
  useEffect(() => {
    console.log('🧪 Monitoring Test Component Loaded');
    console.log('📊 Available monitoring functions:', {
      trackError: typeof trackError,
      trackAcademicEvents: typeof trackAcademicEvents,
      measurePerformance: typeof measurePerformance,
      monitorAPICall: typeof monitorAPICall,
      getWebVitalsData: typeof getWebVitalsData
    });

    // Test message tracking
    trackMessage('Monitoring Test Component initialized', 'info');
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🧪 Monitoring y Analytics Test Suite
        </h1>
        <p className="text-gray-600">
          Prueba todas las funcionalidades de monitoring implementadas
        </p>
      </div>

      {/* Current Status */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h2 className="text-xl font-semibold mb-4">Estado Actual del Sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium">Health Status:</span>
            <div className={health.status === 'healthy' ? 'text-green-600' : 'text-red-600'}>
              {health.status.toUpperCase()}
            </div>
          </div>
          <div>
            <span className="font-medium">Environment:</span>
            <div>{import.meta.env.MODE}</div>
          </div>
          <div>
            <span className="font-medium">Monitoring:</span>
            <div>{import.meta.env.PROD ? '✅ Enabled' : '⚠️ Development'}</div>
          </div>
          <div>
            <span className="font-medium">Timestamp:</span>
            <div>{new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </Card>

      {/* Test Controls */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Controles de Prueba</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <button
            onClick={testErrorTracking}
            disabled={isRunning}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            🚨 Test Error Tracking
          </button>
          
          <button
            onClick={testAnalytics}
            disabled={isRunning}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            📊 Test Analytics
          </button>
          
          <button
            onClick={testPerformance}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            ⚡ Test Performance
          </button>
          
          <button
            onClick={testAPI}
            disabled={isRunning}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            🌐 Test API Monitoring
          </button>
          
          <button
            onClick={testWebVitals}
            disabled={isRunning}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            📈 Test Web Vitals
          </button>
          
          <button
            onClick={testHealthChecks}
            disabled={isRunning}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            🔍 Test Health Checks
          </button>
        </div>

        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
        >
          {isRunning ? '🔄 Running All Tests...' : '🚀 Run All Tests'}
        </button>
      </Card>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Resultados de Pruebas</h2>
          <div className="space-y-3">
            {Object.entries(testResults).map(([key, result]) => (
              <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <div className="text-sm">
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <h2 className="text-xl font-semibold mb-4">📋 Instrucciones de Verificación</h2>
        <div className="space-y-3 text-sm">
          <div>
            <strong>1. Sentry:</strong> Abre tu proyecto en Sentry.io y verifica que aparezcan los errores de prueba
          </div>
          <div>
            <strong>2. Google Analytics:</strong> Ve a Analytics &gt; Real-time y observa los eventos
          </div>
          <div>
            <strong>3. Console:</strong> Revisa la consola del navegador por logs de monitoring
          </div>
          <div>
            <strong>4. Network:</strong> En DevTools &gt; Network, busca llamadas a google-analytics.com y sentry.io
          </div>
          <div>
            <strong>5. Performance:</strong> En DevTools &gt; Performance, analiza las métricas
          </div>
        </div>
      </Card>

      {/* Environment Info */}
      <Card className="p-6 bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">🔧 Información de Entorno</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>SENTRY_DSN:</strong> {import.meta.env.VITE_SENTRY_DSN ? '✅ Configurado' : '❌ No configurado'}
          </div>
          <div>
            <strong>GA4_MEASUREMENT_ID:</strong> {import.meta.env.VITE_GA4_MEASUREMENT_ID ? '✅ Configurado' : '❌ No configurado'}
          </div>
          <div>
            <strong>PRODUCTION:</strong> {import.meta.env.PROD ? '✅ Sí' : '❌ No (Development)'}
          </div>
          <div>
            <strong>MONITORING_ENABLED:</strong> {import.meta.env.PROD ? '✅ Sí' : '⚠️ Solo en producción'}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MonitoringTest;