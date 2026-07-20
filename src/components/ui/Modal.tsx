import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ModalTone } from "../../contexts/ModalContext";

interface ModalProps {
  title: string;
  message: string;
  isOpen: boolean;
  onClose: () => void;
  tone?: ModalTone;
}

const TONE_CONTENT: Record<ModalTone, { icon: string; label: string; closeText: string }> = {
  success: { icon: "check", label: "Operación confirmada", closeText: "Listo" },
  error: { icon: "priority_high", label: "No pudimos completar la operación", closeText: "Cerrar" },
  info: { icon: "info", label: "Información", closeText: "Entendido" },
};

const Modal: React.FC<ModalProps> = ({ title, message, isOpen, onClose, tone = "info" }) => {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toneContent = TONE_CONTENT[tone];

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
      closeButtonRef.current?.focus();
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

  return createPortal(
    <div
      className={`ui-modal-overlay fixed inset-0 z-[20000] flex items-center justify-center p-4 ui-modal-overlay--${tone} ${isVisible ? "is-visible" : ""}`}
      aria-labelledby="modal-title"
      aria-describedby="modal-message"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="ui-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal-status" aria-hidden="true">
          <span className="material-icons">{toneContent.icon}</span>
        </div>
        <div className="ui-modal-copy">
          <span className="ui-modal-label">{toneContent.label}</span>
          <h2 id="modal-title">{title}</h2>
          <p id="modal-message">{message}</p>
        </div>
        <div className="ui-modal-actions">
          <button ref={closeButtonRef} onClick={onClose} className="ui-modal-button">
            {toneContent.closeText}
            <span className="material-icons" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
