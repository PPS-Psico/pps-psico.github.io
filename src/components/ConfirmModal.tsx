import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "info" | "danger";
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onClose,
  confirmText = "Continuar",
  cancelText = "Cancelar",
  type = "warning",
}) => {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let animationFrame: number | undefined;
    let exitTimer: number | undefined;

    if (isOpen) {
      setShouldRender(true);
      animationFrame = window.requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      exitTimer = window.setTimeout(() => setShouldRender(false), 160);
    }

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (shouldRender && mounted) {
      document.body.style.overflow = "hidden";
      cancelButtonRef.current?.focus();
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, shouldRender]);

  if (!shouldRender || !mounted) return null;

  const toneContent = {
    warning: { icon: "warning_amber", label: "Revisá antes de continuar" },
    info: { icon: "info", label: "Confirmá esta acción" },
    danger: { icon: "priority_high", label: "Esta acción es irreversible" },
  };
  const content = toneContent[type];

  return createPortal(
    <div
      className={`ui-modal-overlay ui-modal-overlay--${type} fixed inset-0 z-[20000] flex items-center justify-center p-4 ${isVisible ? "is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      onClick={onClose}
    >
      <div className="ui-modal-dialog ui-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal-status" aria-hidden="true">
          <span className="material-icons">{content.icon}</span>
        </div>
        <div className="ui-modal-copy">
          <span className="ui-modal-label">{content.label}</span>
          <h2 id="confirm-modal-title">{title}</h2>
          <div id="confirm-modal-message" className="ui-confirm-message">
            {message}
          </div>
        </div>

        <div className="ui-modal-actions ui-confirm-actions">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            className="ui-confirm-button ui-confirm-button--secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="ui-confirm-button ui-confirm-button--primary"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
