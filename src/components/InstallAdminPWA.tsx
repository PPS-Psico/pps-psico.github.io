import React, { useState, useEffect } from "react";

const InstallAdminPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showButton, setShowButton] = useState(true);

  useEffect(() => {
    // Capturar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      if (isStandalone) {
        alert(
          "Ya tenés una PWA instalada.\n\nPara instalar la versión Admin:\n\n1. Desinstalá la PWA actual de tu dispositivo\n2. Volvé a entrar a esta página\n3. Instalá nuevamente"
        );
      } else {
        alert(
          "Para instalar:\n\nAndroid: Menú (⋮) → 'Agregar a pantalla de inicio'\n\niOS: Compartir (□↑) → 'Agregar a pantalla de inicio'"
        );
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowButton(false);
  };

  if (!showButton) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999]">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="material-icons">admin_panel_settings</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">Instalar Gestión PPS</h3>
          <p className="text-xs text-white/80 mt-0.5">Accede rápido desde tu pantalla de inicio</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="px-2 py-1 text-xs font-medium text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-lg shadow-lg hover:bg-blue-50 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallAdminPWA;
