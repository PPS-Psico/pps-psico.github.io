// ──────────────────────────────────────────────────────────────────────────
// useConfirm — confirmación con la UI del panel, con la ergonomía de
// `window.confirm`.
//
// El diálogo nativo rompe el diseño editorial, ignora el tema claro/oscuro y
// no es estilable. Este hook devuelve una función que resuelve una promesa,
// así migrar un `if (window.confirm(...))` es directo:
//
//   const { confirm, confirmDialog } = useConfirm();
//   ...
//   if (await confirm({ title: "¿Borrar?", message: "No se puede deshacer." })) { … }
//   ...
//   return (<>{contenido}{confirmDialog}</>);
//
// Sólo hay un diálogo por hook: una confirmación pendiente se reemplaza por la
// siguiente (resolviendo la anterior como cancelada).
// ──────────────────────────────────────────────────────────────────────────
import React, { useCallback, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "info" | "danger";
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

export interface UseConfirmResult {
  /** Abre el diálogo y resuelve true/false según lo que elija el usuario. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Renderizar una vez dentro del árbol del componente. */
  confirmDialog: React.ReactNode;
}

export function useConfirm(): UseConfirmResult {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // Si había una confirmación abierta, se cancela antes de abrir la nueva
    // para no dejar promesas colgadas.
    resolverRef.current?.(false);
    setState({ ...opts, isOpen: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const confirmDialog = (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      type={state.type}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}

export default useConfirm;
