
import React, { useState, useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'warning';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Small delay to ensure DOM is ready before animating in
        const entryTimer = setTimeout(() => setIsVisible(true), 50);

        const exitTimer = setTimeout(() => {
            setIsVisible(false);
            // Allow time for fade-out animation before calling onClose
            setTimeout(onClose, 300);
        }, duration);

        return () => {
            clearTimeout(entryTimer);
            clearTimeout(exitTimer);
        };
    }, [duration, onClose]);

    let stateClasses = '';
    let icon = '';
    let iconColor = '';

    switch (type) {
        case 'success':
            stateClasses = 'bg-emerald-50 border-emerald-200 text-emerald-800';
            icon = 'check_circle';
            iconColor = 'text-emerald-500';
            break;
        case 'warning':
            stateClasses = 'bg-amber-50 border-amber-200 text-amber-800';
            icon = 'warning';
            iconColor = 'text-amber-500';
            break;
        case 'error':
        default:
            stateClasses = 'bg-rose-50 border-rose-200 text-rose-800';
            icon = 'error';
            iconColor = 'text-rose-500';
            break;
    }

    const baseClasses = 'fixed top-5 right-5 z-[2000] flex items-center gap-4 w-full max-w-sm p-4 rounded-xl shadow-lg border transition-all duration-300 ease-in-out';
    const visibilityClasses = isVisible
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 -translate-y-4';

    return (
        <div
            className={`${baseClasses} ${stateClasses} ${visibilityClasses}`}
            role="alert"
            aria-live="polite"
        >
            <div className={`flex-shrink-0 ${iconColor}`}>
                <span className="material-icons">{icon}</span>
            </div>
            {/* 
         CRITICAL FIX: Wrap text in a span. 
         Google Translate often replaces text nodes directly. If React holds a reference 
         to that text node and it gets replaced by a <font> tag, React crashes on unmount/update.
         Wrapping it isolates the text node.
      */}
            <div className="flex-grow text-sm font-medium">
                <span>{message}</span>
            </div>
            <button
                onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
                className="flex-shrink-0 p-1 -m-1 rounded-full hover:bg-black/10 transition-colors"
                aria-label="Cerrar notificación"
            >
                <span className="material-icons !text-base">close</span>
            </button>
        </div>
    );
};

export default Toast;
