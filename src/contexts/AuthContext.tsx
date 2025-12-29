
import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { 
    FIELD_LEGAJO_ESTUDIANTES, 
    FIELD_NOMBRE_ESTUDIANTES, 
    FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
    FIELD_USER_ID_ESTUDIANTES,
    FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES,
    FIELD_ROLE_ESTUDIANTES
} from '../constants';

export type AuthUser = {
  id?: string;
  legajo: string;
  nombre: string;
  role?: 'Jefe' | 'SuperUser' | 'Directivo' | 'AdminTester' | 'Reportero';
  orientaciones?: string[];
  mustChangePassword?: boolean;
};

interface AuthContextType {
  authenticatedUser: AuthUser | null;
  isSuperUserMode: boolean;
  isJefeMode: boolean;
  isDirectivoMode: boolean;
  isAdminTesterMode: boolean;
  isReporteroMode: boolean;
  isAuthLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  completePasswordChange: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const queryClient = useQueryClient();
  
  // Refs to track state without triggering re-renders
  const refreshLoopCounter = useRef(0);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authStabilizationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Función de limpieza profunda
  const deepCleanup = useCallback(() => {
     console.log("🧹 Ejecutando limpieza profunda de sesión...");
     localStorage.removeItem('sb-qxnxtnhtbpsgzprqtrjl-auth-token');
     sessionStorage.clear();
     queryClient.clear();
     setAuthenticatedUser(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
        console.log("🚪 Cerrando sesión...");
        
        // 1. Cancel React Query fetching
        queryClient.cancelQueries();
        
        // 2. Clear local state first
        setAuthenticatedUser(null);
        
        // 3. Sign out from Supabase (Safe catch if no session exists)
        const { error } = await (supabase.auth as any).signOut();
        if (error) console.warn("Supabase signOut warning:", error.message);

        // 4. Force cleanup
        deepCleanup();
        
    } catch (error) {
        console.error("Error during forced logout:", error);
        deepCleanup();
    }
  }, [queryClient, deepCleanup]);

  useEffect(() => {
    let isMounted = true;

    // Clear any existing timeout
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    // Safety Timeout: If nothing happens in 8 seconds, stop loading.
    safetyTimeoutRef.current = setTimeout(() => {
        if (isMounted && isAuthLoading) {
            console.warn("⚠️ Auth check timed out. Stopping spinner.");
            setIsAuthLoading(false);
        }
    }, 8000);

    const processSession = async (session: any) => {
        // If no session, clear user and stop loading
        if (!session?.user) {
            if (isMounted) {
                setAuthenticatedUser(null);
                setIsAuthLoading(false);
            }
            return;
        }

        try {
            // Fetch profile from DB
            const { data: profile, error } = await supabase
                .from('estudiantes')
                .select(`${FIELD_LEGAJO_ESTUDIANTES}, ${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES}, ${FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES}, ${FIELD_ROLE_ESTUDIANTES}`)
                .eq(FIELD_USER_ID_ESTUDIANTES, session.user.id) 
                .maybeSingle();

            if (isMounted) {
                if (profile && !error) {
                    const dbRole = profile[FIELD_ROLE_ESTUDIANTES] as AuthUser['role'] | undefined;
                    
                    // Stabilization: Delay the state update slightly to let previous React tree unmount cleanly
                    if (authStabilizationTimer.current) clearTimeout(authStabilizationTimer.current);
                    
                    authStabilizationTimer.current = setTimeout(() => {
                        setAuthenticatedUser({
                            id: session.user.id,
                            legajo: profile[FIELD_LEGAJO_ESTUDIANTES],
                            nombre: profile[FIELD_NOMBRE_ESTUDIANTES],
                            orientaciones: profile[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] ? [profile[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]] : [],
                            mustChangePassword: profile[FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES],
                            role: dbRole
                        });
                        setIsAuthLoading(false);
                    }, 50); // Small delay to decouple from event loop

                } else {
                    console.warn("Profile not found for authenticated user. Posible Admin o Error de Integridad.");
                    if (session.user.email !== 'admin@uflo.edu.ar') {
                         setAuthenticatedUser(null);
                         setIsAuthLoading(false);
                    }
                }
            }
        } catch (err) {
            console.error("Profile fetch error:", err);
            if (isMounted) {
                setAuthenticatedUser(null);
                setIsAuthLoading(false);
            }
        }
    };

    // Initialize: Get current session
    (supabase.auth as any).getSession().then(({ data, error }: any) => {
        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes("refresh token") || msg.includes("not found") || msg.includes("invalid")) {
                console.error("🚨 Token corrupto detectado. Limpiando almacenamiento.");
                deepCleanup();
            }
            if (isMounted) setIsAuthLoading(false);
        } else {
            processSession(data.session);
        }
    });

    // Listen for changes
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
      async (event: string, session: any) => {
        console.log(`AUTH EVENT: ${event}`);

        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

        if (event === 'TOKEN_REFRESHED') {
            refreshLoopCounter.current += 1;
            if (refreshLoopCounter.current > 3) {
                console.error("🔄 Bucle de refresco detectado. Forzando salida.");
                refreshLoopCounter.current = 0;
                deepCleanup();
                if (isMounted) setIsAuthLoading(false);
                return;
            }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            refreshLoopCounter.current = 0;
            processSession(session);
        } else if (event === 'SIGNED_OUT') {
            refreshLoopCounter.current = 0;
            if (isMounted) {
                setAuthenticatedUser(null);
                setIsAuthLoading(false);
                queryClient.clear();
            }
        }
    }
    );

    return () => {
        isMounted = false;
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        if (authStabilizationTimer.current) clearTimeout(authStabilizationTimer.current);
        subscription.unsubscribe();
    };
  }, [queryClient, deepCleanup]);

  const login = useCallback((user: AuthUser) => {
    setAuthenticatedUser(user);
    setIsAuthLoading(false);
  }, []);

  const completePasswordChange = useCallback(() => {
    setAuthenticatedUser(prev => prev ? { ...prev, mustChangePassword: false } : null);
  }, []);

  const isSuperUserMode = authenticatedUser?.role === 'SuperUser' || authenticatedUser?.legajo === 'admin';
  const isJefeMode = authenticatedUser?.role === 'Jefe';
  const isDirectivoMode = authenticatedUser?.role === 'Directivo';
  const isAdminTesterMode = authenticatedUser?.role === 'AdminTester';
  const isReporteroMode = authenticatedUser?.role === 'Reportero';

  return (
    <AuthContext.Provider value={{ authenticatedUser, isSuperUserMode, isJefeMode, isDirectivoMode, isAdminTesterMode, isReporteroMode, isAuthLoading, login, logout, completePasswordChange }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
