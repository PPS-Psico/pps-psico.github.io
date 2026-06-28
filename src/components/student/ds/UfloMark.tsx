import React from "react";

interface UfloMarkProps {
  size?: number;
  className?: string;
}

export const UfloMark: React.FC<UfloMarkProps> = ({ size = 22, className }) => {
  return (
    <span
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        background: "#46253D",
        color: "#FFFDF6",
        borderRadius: 6,
        fontFamily: '"Bricolage Grotesque", serif',
        fontStyle: "italic",
        fontSize: size * 0.62,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: 0,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      U
    </span>
  );
};

export default UfloMark;
