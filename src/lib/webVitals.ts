// Web Vitals Monitoring for Core Web Vitals
import React from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: any) => void;
  }
}

// Web Vitals thresholds (based on Google recommendations)
const VITAL_THRESHOLDS = {
  CLS: { good: 0.1, needs_improvement: 0.25 }, // Cumulative Layout Shift
  INP: { good: 200, needs_improvement: 500 },   // Interaction to Next Paint (ms)
  FCP: { good: 1800, needs_improvement: 3000 }, // First Contentful Paint (ms)
  LCP: { good: 2500, needs_improvement: 4000 }, // Largest Contentful Paint (ms)
  TTFB: { good: 800, needs_improvement: 1800 }  // Time to First Byte (ms)
};

// Store vitals for analysis
let vitalsData: any = {};

// Initialize Web Vitals monitoring
export const initWebVitals = () => {
  if (import.meta.env.PROD) {
    console.log('📊 Initializing Web Vitals monitoring...');

    // Cumulative Layout Shift
    onCLS((metric: any) => {
      vitalsData.CLS = metric;
      handleWebVital('CLS', metric);
    });

    // First Input Delay (now Interaction to Next Paint)
    onINP((metric: any) => {
      vitalsData.INP = metric;
      handleWebVital('INP', metric);
    });

    // First Contentful Paint
    onFCP((metric: any) => {
      vitalsData.FCP = metric;
      handleWebVital('FCP', metric);
    });

    // Largest Contentful Paint
    onLCP((metric: any) => {
      vitalsData.LCP = metric;
      handleWebVital('LCP', metric);
    });

    // Time to First Byte
    onTTFB((metric: any) => {
      vitalsData.TTFB = metric;
      handleWebVital('TTFB', metric);
    });
  }
};

// Handle individual web vital
const handleWebVital = (name: string, metric: any) => {
  const threshold = VITAL_THRESHOLDS[name as keyof typeof VITAL_THRESHOLDS];
  const rating = getRating(metric.value, threshold);
  
  console.log(`📈 ${name}: ${metric.value} (${rating})`);

  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'web_vital', {
      event_category: 'Web Vitals',
      event_label: name,
      value: Math.round(metric.value),
      custom_map: {
        dimension1: 'rating',
        dimension2: 'id'
      },
      rating,
      id: metric.id
    });
  }

  // Send to Sentry if performance is poor
  if (rating === 'poor') {
    import('./sentry').then(({ trackMessage }) => {
      trackMessage(`Poor ${name}: ${metric.value}`, 'warning');
    });
  }

  // Store for dashboard
  vitalsData[name] = { ...metric, rating };
};

// Get rating based on thresholds
const getRating = (value: number, threshold: any): 'good' | 'needs_improvement' | 'poor' => {
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needs_improvement) return 'needs_improvement';
  return 'poor';
};

// Get all vitals data
export const getWebVitalsData = () => vitalsData;

// Performance monitoring for specific operations
export const measurePerformance = (operationName: string, operation: () => Promise<any> | any) => {
  const startTime = performance.now();
  
  const measure = async () => {
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      
      // Track performance
      if (window.gtag) {
        window.gtag('event', 'performance_metric', {
          event_category: 'Performance',
          event_label: operationName,
          value: Math.round(duration)
        });
      }
      
      // Alert if operation is slow
      if (duration > 3000) { // 3 seconds threshold
        import('./sentry').then(({ trackMessage }) => {
          trackMessage(`Slow operation: ${operationName} took ${duration.toFixed(2)}ms`, 'warning');
        });
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`❌ ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      
      // Track failed performance
      if (window.gtag) {
        window.gtag('event', 'performance_error', {
          event_category: 'Performance',
          event_label: operationName,
          value: Math.round(duration)
        });
      }
      
      throw error;
    }
  };
  
  return measure();
};

// Monitor React component render performance
export const withPerformanceMonitoring = <P extends object>(
  ComponentToMonitor: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> => {
  const MonitoredComponent = (props: P) => {
    const renderStartTime = React.useRef<number>();
    
    React.useLayoutEffect(() => {
      renderStartTime.current = performance.now();
    });
    
    React.useEffect(() => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        
        if (renderTime > 16) { // More than one frame
          console.warn(`🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
        }
      }
    });
    
    return React.createElement(ComponentToMonitor, props);
  };
  
  MonitoredComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  
  return MonitoredComponent;
};

// Monitor API calls
export const monitorAPICall = async (apiCall: () => Promise<any>, apiCallName: string) => {
  const startTime = performance.now();
  
  try {
    const result = await apiCall();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`🌐 ${apiCallName}: ${duration.toFixed(2)}ms`);
    
    // Track API performance
    if (window.gtag) {
      window.gtag('event', 'api_call', {
        event_category: 'API Performance',
        event_label: apiCallName,
        value: Math.round(duration)
      });
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.error(`❌ ${apiCallName} failed after ${duration.toFixed(2)}ms:`, error);
    
    // Track failed API calls
    if (window.gtag) {
      window.gtag('event', 'api_error', {
        event_category: 'API Performance',
        event_label: apiCallName,
        value: Math.round(duration)
      });
    }
    
    throw error;
  }
};

// Get performance score (0-100)
export const getPerformanceScore = (): number => {
  const vitals = getWebVitalsData();
  let score = 100;
  
  Object.entries(vitals).forEach(([_name, data]: [string, any]) => {
    if (data.rating === 'needs_improvement') {
      score -= 15;
    } else if (data.rating === 'poor') {
      score -= 30;
    }
  });
  
  return Math.max(0, score);
};