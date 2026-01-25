import React, { useEffect, useState } from 'react';

const InstallPWA: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Detectar iOS (no soporta beforeinstallprompt, necesita instrucciones manuales)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

        if (isIosDevice && !isInStandaloneMode) {
            setIsIOS(true);
            setIsVisible(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt && !isIOS) return;

        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsVisible(false);
            }
        } else if (isIOS) {
            alert("Para instalar en iOS: toca el botón 'Compartir' y selecciona 'Agregar a Inicio'.");
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-[9999] md:hidden animate-slide-up-fade">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                        <span className="material-icons !text-2xl text-blue-400">install_mobile</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Instalar App Admin</h4>
                        <p className="text-[10px] text-slate-400">Recibe notificaciones y acceso rápido</p>
                    </div>
                </div>
                <button
                    onClick={handleInstallClick}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                >
                    INSTALAR
                </button>
                <button onClick={() => setIsVisible(false)} className="text-slate-500 hover:text-white">
                    <span className="material-icons !text-lg">close</span>
                </button>
            </div>
        </div>
    );
};

export default InstallPWA;
