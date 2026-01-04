import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    title: string;
    message: string;
    isOpen: boolean;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ title, message, isOpen, onClose }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity duration-300 animate-fade-in"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-lg text-center transform transition-all duration-300 scale-100 opacity-100 border border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="mx-auto bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-14 h-14 rounded-full flex items-center justify-center mb-5">
                    <span className="material-icons !text-3xl">info</span>
                </div>
                <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">{title}</h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mb-8 leading-relaxed whitespace-pre-wrap">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-sm sm:text-base 
                     transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 shadow-lg hover:shadow-blue-500/20"
                    aria-label="Cerrar modal"
                >
                    Entendido
                </button>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
