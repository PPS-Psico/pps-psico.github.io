import React from "react";

export type IconName =
  | "arrow"
  | "arrowback"
  | "home"
  | "bag"
  | "file"
  | "user"
  | "moon"
  | "sun"
  | "bell"
  | "cal"
  | "chev"
  | "heart"
  | "help"
  | "settings"
  | "book"
  | "upload"
  | "download"
  | "search"
  | "lock"
  | "eye"
  | "idcard"
  | "check"
  | "clock"
  | "shield"
  | "play"
  | "plus"
  | "trash"
  | "alert"
  | "x";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

const PATHS: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  arrowback: (
    <>
      <path d="M19 12H5" />
      <path d="M11 19l-7-7 7-7" />
    </>
  ),
  home: (
    <>
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path d="M14 3v6h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  heart: (
    <>
      <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h10a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H4V4z" />
      <path d="M4 4v14h11a3 3 0 0 1 3 3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 3v14" />
      <path d="M6 9l6-6 6 6" />
      <path d="M3 21h18" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v14" />
      <path d="M6 11l6 6 6-6" />
      <path d="M3 21h18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  idcard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />,
  play: <path d="M6 4l14 8-14 8V4z" fill="currentColor" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 18,
  strokeWidth = 1.7,
  color = "currentColor",
  className,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
};

export default Icon;
