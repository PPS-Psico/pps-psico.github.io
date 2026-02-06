import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

const shortcuts: ShortcutGroup[] = [
  {
    title: "Navegación",
    shortcuts: [
      { key: "←", description: "Archivo anterior" },
      { key: "→", description: "Archivo siguiente" },
      { key: "ESC", description: "Cerrar previsualizador" },
    ],
  },
  {
    title: "Vista",
    shortcuts: [
      { key: "F", description: "Pantalla completa" },
      { key: "T", description: "Mostrar/ocultar miniaturas" },
    ],
  },
  {
    title: "Información",
    shortcuts: [
      { key: "Ctrl + I", description: "Información del archivo" },
      { key: "?", description: "Mostrar atajos de teclado" },
    ],
  },
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-lg"
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <span className="material-icons text-purple-400">keyboard</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Atajos de teclado</h3>
                    <p className="text-sm text-gray-400">Navega más rápido</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <span className="material-icons">close</span>
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-6">
                {shortcuts.map((group, idx) => (
                  <div key={idx}>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {group.title}
                    </h4>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut, sIdx) => (
                        <motion.div
                          key={sIdx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: sIdx * 0.05 }}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-300">{shortcut.description}</span>
                          <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-white">
                            {shortcut.key}
                          </kbd>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-slate-800/50">
                <p className="text-xs text-gray-500 text-center">
                  Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-gray-400">?</kbd>{" "}
                  en cualquier momento para ver estos atajos
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default KeyboardShortcuts;
