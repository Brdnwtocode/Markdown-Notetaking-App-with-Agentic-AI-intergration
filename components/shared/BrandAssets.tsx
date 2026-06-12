import React from "react";

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  iconColor?: string;
  textColor?: string;
}

export interface PrimaryLogoProps extends LogoProps {
  taglineColor?: string;
}

export interface SubmarkProps extends LogoProps {
  ringColor?: string;
  dashColor?: string;
}

export interface FaviconProps extends LogoProps {
  bgColor?: string;
}

/**
 * Primary Logo (Horizontal)
 * Purpose: Main branding for website headers, navigation bars, and large-scale print.
 */
export const PrimaryLogo: React.FC<PrimaryLogoProps> = ({
  iconColor = "#10B981",
  textColor = "#FFFFFF",
  taglineColor = "#A1A1AA",
  width = 400,
  height = 120,
  ...props
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 120"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="400" height="120" fill="none" />
      {/* Logo Icon: Interlocking L-shapes */}
      <g transform="translate(20, 25)" shapeRendering="geometricPrecision">
        <path d="M0 15V0H30V10H10V50H0V15Z" fill={iconColor} />
        <path d="M50 35V50H20V40H40V0H50V35Z" fill={iconColor} />
      </g>
      {/* Wordmark */}
      <text
        x="90"
        y="65"
        fontFamily="Geist, Inter, sans-serif"
        fontSize="52"
        fontWeight="800"
        letterSpacing="-2"
        fill={textColor}
      >
        Lock In
      </text>
      {/* Tagline */}
      <text
        x="92"
        y="95"
        fontFamily="Geist Mono, monospace"
        fontSize="12"
        fontWeight="500"
        letterSpacing="4"
        fill={taglineColor}
      >
        FLOW STATE ACTIVE
      </text>
    </svg>
  );
};

/**
 * Secondary Logo (Stacked)
 * Purpose: Use in centered layouts, mobile splash screens, or square/vertical containers.
 */
export const SecondaryLogo: React.FC<LogoProps> = ({
  iconColor = "#10B981",
  textColor = "#FFFFFF",
  width = 200,
  height = 200,
  ...props
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="200" height="200" fill="none" />
      {/* Centered Logo Icon */}
      <g transform="translate(75, 40)" shapeRendering="geometricPrecision">
        <path d="M0 15V0H30V10H10V50H0V15Z" fill={iconColor} />
        <path d="M50 35V50H20V40H40V0H50V35Z" fill={iconColor} />
      </g>
      {/* Centered Wordmark */}
      <text
        x="100"
        y="145"
        textAnchor="middle"
        fontFamily="Geist, Inter, sans-serif"
        fontSize="36"
        fontWeight="800"
        letterSpacing="-1.5"
        fill={textColor}
      >
        Lock In
      </text>
    </svg>
  );
};

/**
 * Submark (Circular)
 * Purpose: Social media profile pictures, watermarks, or decorative UI elements.
 */
export const Submark: React.FC<SubmarkProps> = ({
  iconColor = "#10B981",
  textColor = "#FFFFFF",
  ringColor = "#27272A",
  dashColor = "#10B981",
  width = 128,
  height = 128,
  ...props
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="64" cy="64" r="62" fill="none" stroke={ringColor} strokeWidth="1" />
      <circle
        cx="64"
        cy="64"
        r="58"
        fill="none"
        stroke={dashColor}
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      {/* Icon centered */}
      <g transform="translate(39, 34)" shapeRendering="geometricPrecision">
        <path d="M0 15V0H30V10H10V50H0V15Z" fill={iconColor} />
        <path d="M50 35V50H20V40H40V0H50V35Z" fill={iconColor} />
      </g>
      <text
        x="64"
        y="105"
        textAnchor="middle"
        fontFamily="Geist Mono, monospace"
        fontSize="16"
        fontWeight="700"
        fill={textColor}
      >
        LI
      </text>
    </svg>
  );
};

/**
 * Favicon (Minimalist)
 * Purpose: Browser tabs, app shortcuts, or micro-UI indicators (16px - 32px).
 */
export const Favicon: React.FC<FaviconProps> = ({
  iconColor = "#0E0E0E",
  bgColor = "#10B981",
  width = 32,
  height = 32,
  ...props
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="32" height="32" rx="4" fill={bgColor} />
      {/* Simplified Icon for legibility */}
      <g transform="translate(6, 6) scale(0.4)" shapeRendering="geometricPrecision">
        <path d="M0 15V0H30V10H10V50H0V15Z" fill={iconColor} />
        <path d="M50 35V50H20V40H40V0H50V35Z" fill={iconColor} />
      </g>
    </svg>
  );
};
