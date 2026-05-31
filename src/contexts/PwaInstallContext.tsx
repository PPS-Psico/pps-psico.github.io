import { logger } from "../utils/logger";
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";

// Define el tipo para el evento BeforeInstallPromptEvent para mayor seguridad de tipos.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaInstallContextType {
  canInstall: boolean;
  triggerInstall: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextType | undefined>(undefined);

export const PwaInstallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Evita que el mini-infobar de Chrome aparezca automáticamente
      e.preventDefault();
      // Guarda el evento para que pueda ser disparado más tarde.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Escucha el evento 'appinstalled' para saber cuándo se instaló la PWA
    const handleAppInstalled = () => {
      // Limpia el prompt guardado ya que ya no se puede usar.
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      // Muestra el diálogo de instalación.
      await deferredPrompt.prompt();
      // Espera a que el usuario responda al diálogo.
      const { outcome } = await deferredPrompt.userChoice;
      logger.info(`Respuesta del usuario al diálogo de instalación: ${outcome}`);
      // El prompt ya se usó y no se puede volver a usar.
      // El estado se limpiará cuando el evento 'appinstalled' se dispare.
    }
  }, [deferredPrompt]);

  return (
    <PwaInstallContext.Provider value={{ canInstall: !!deferredPrompt, triggerInstall }}>
      {children}
    </PwaInstallContext.Provider>
  );
};

export const usePwaInstall = (): PwaInstallContextType => {
  const context = useContext(PwaInstallContext);
  if (context === undefined) {
    throw new Error("usePwaInstall debe ser usado dentro de un PwaInstallProvider");
  }
  return context;
};
