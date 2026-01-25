import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { HORAS_OBJETIVO_TOTAL, HORAS_OBJETIVO_ORIENTACION, ROTACION_OBJETIVO_ORIENTACIONES } from '../constants';

interface AppConfig {
  horasObjetivoTotal: number;
  horasObjetivoOrientacion: number;
  rotacionObjetivo: number;
}

const defaultConfig: AppConfig = {
  horasObjetivoTotal: HORAS_OBJETIVO_TOTAL,
  horasObjetivoOrientacion: HORAS_OBJETIVO_ORIENTACION,
  rotacionObjetivo: ROTACION_OBJETIVO_ORIENTACIONES,
};

const ConfigContext = createContext<AppConfig>(defaultConfig);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Intentamos buscar una tabla 'app_config' si existe en el futuro
        // Por ahora, simulamos o usamos los defaults.
        const { data, error } = await supabase
          .from('app_config' as any) // Cast as any until table exists in types
          .select('*')
          .single();

        if (!error && data) {
          setConfig({
            horasObjetivoTotal: (data as any).horas_objetivo_total ?? defaultConfig.horasObjetivoTotal,
            horasObjetivoOrientacion: (data as any).horas_objetivo_orientacion ?? defaultConfig.horasObjetivoOrientacion,
            rotacionObjetivo: (data as any).rotacion_objetivo ?? defaultConfig.rotacionObjetivo,
          });
        }
      } catch (e) {
        // Fallback silencioso a defaults si la tabla no existe
        console.warn("Using default app config");
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useAppConfig = () => useContext(ConfigContext);