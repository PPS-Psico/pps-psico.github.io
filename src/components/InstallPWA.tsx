import React, { useEffect, useState } from 'react';
import { usePwaInstall } from '../contexts/PwaInstallContext';

const InstallPWA: React.FC = () => {
    const { canInstall, triggerInstall } = usePwaInstall();
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Mostrar si el navegador indica que se puede instalar (Android/Desktop Chrome)
        if (canInstall) {
            setIsVisible(true);
        }

        // Detectar iOS específicamente (no soporta beforeinstallprompt)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

        if (isIosDevice && !isInStandaloneMode) {
            setIsIOS(true);
            setIsVisible(true);
        }
    }, [canInstall]);

    const handleInstallClick = () => {
        if (isIOS) {
            alert("Para instalar en iOS: toca el botón 'Compartir' de Safari y selecciona 'Agregar a Inicio'.");
        } else {
            triggerInstall();
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-[9999] md:hidden">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-4 animate-scale-in">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl">
                        <span className="material-icons !text-2xl text-blue-400">install_mobile</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm leading-tight text-white">Instalar Aplicación</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Acceso rápido y notificaciones</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleInstallClick}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-tighter"
                    >
                        Instalar
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1 text-slate-500 hover:text-white transition-colors"
                    >
                        <span className="material-icons !text-lg">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPWA;
