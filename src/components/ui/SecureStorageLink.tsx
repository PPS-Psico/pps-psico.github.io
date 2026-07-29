import React, { useEffect, useMemo, useState } from "react";
import { getSignedStorageUrl, getStorageObjectRef } from "../../utils/attachmentUtils";
import { logger } from "../../utils/logger";

type SecureStorageLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

/** Firma documentos privados antes de habilitar el enlace. */
export const SecureStorageLink: React.FC<SecureStorageLinkProps> = ({
  href,
  children,
  onClick,
  ...props
}) => {
  const requiresSignature = useMemo(() => getStorageObjectRef(href) !== null, [href]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(requiresSignature ? null : href);

  useEffect(() => {
    let active = true;
    setResolvedUrl(requiresSignature ? null : href);
    if (!requiresSignature) return () => undefined;

    void getSignedStorageUrl(href)
      .then((url) => active && setResolvedUrl(url))
      .catch((error) => logger.warn("No se pudo preparar el documento privado:", error));

    return () => {
      active = false;
    };
  }, [href, requiresSignature]);

  return (
    <a
      {...props}
      href={resolvedUrl ?? undefined}
      aria-disabled={!resolvedUrl}
      onClick={(event) => {
        if (!resolvedUrl) event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
};
