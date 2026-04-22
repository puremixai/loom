import { cn } from '@/lib/utils';

const COLOR_WARP  = '#171717'; // ink-900
const COLOR_WEFT  = '#0a72ef'; // develop-blue
const COLOR_WHITE = '#ffffff';

const SCALE = {
  xl: { icon: 48, fontSize: 38, letterSpacing: '-0.055em', gap: 16 },
  lg: { icon: 36, fontSize: 28, letterSpacing: '-0.05em',  gap: 13 },
  md: { icon: 24, fontSize: 20, letterSpacing: '-0.04em',  gap: 10 },
  sm: { icon: 20, fontSize: 15, letterSpacing: '-0.04em',  gap: 8  },
  xs: { icon: 16, fontSize: 0,  letterSpacing: '',          gap: 0  },
} as const;

const STROKE = {
  48: 2.0,
  36: 2.2,
  24: 2.4,
  20: 2.6,
  16: 3.0,
} as const;

export type LoomIconSize = keyof typeof STROKE; // 48 | 36 | 24 | 20 | 16

export type LoomLogoSize = keyof typeof SCALE;

interface LoomIconProps {
  size: LoomIconSize;
  className?: string;
}

export function LoomIcon({ size, className }: LoomIconProps) {
  const sw = STROKE[size];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Warp (vertical threads) */}
      <line x1="13" y1="6"  x2="13" y2="38" stroke={COLOR_WARP} strokeWidth={sw} strokeLinecap="round" />
      <line x1="22" y1="6"  x2="22" y2="38" stroke={COLOR_WARP} strokeWidth={sw} strokeLinecap="round" />
      <line x1="31" y1="6"  x2="31" y2="38" stroke={COLOR_WARP} strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 1: warp-on-top at v1 and v3, weft-on-top at v2 */}
      <line x1="6"  y1="15" x2="11" y2="15" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      <line x1="15" y1="15" x2="29" y2="15" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      <line x1="33" y1="15" x2="38" y2="15" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 2: weft-on-top at v1 and v3, warp-on-top at v2 */}
      <line x1="6"  y1="22" x2="15" y2="22" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      <line x1="20" y1="22" x2="38" y2="22" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      {/* Weft row 3: warp-on-top at v1 and v3, weft-on-top at v2 */}
      <line x1="6"  y1="29" x2="11" y2="29" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      <line x1="15" y1="29" x2="29" y2="29" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      <line x1="33" y1="29" x2="38" y2="29" stroke={COLOR_WEFT} strokeWidth={sw} strokeLinecap="round" />
      {/* White covers at warp-on-top intersections (simulates weave depth) */}
      <rect x="11" y="13" width="4" height="4" fill={COLOR_WHITE} />
      <rect x="29" y="13" width="4" height="4" fill={COLOR_WHITE} />
      <rect x="20" y="20" width="4" height="4" fill={COLOR_WHITE} />
      <rect x="11" y="27" width="4" height="4" fill={COLOR_WHITE} />
      <rect x="29" y="27" width="4" height="4" fill={COLOR_WHITE} />
    </svg>
  );
}

interface LoomLogoProps {
  size: LoomLogoSize;
  className?: string;
}

export function LoomLogo({ size, className }: LoomLogoProps) {
  const { icon, fontSize, letterSpacing, gap } = SCALE[size];
  return (
    <div className={cn('flex items-center', className)} style={{ gap }}>
      <LoomIcon size={icon} />
      {fontSize > 0 && (
        <span className="font-semibold" style={{ fontSize, letterSpacing, lineHeight: 1, color: COLOR_WARP }}>
          loom
        </span>
      )}
    </div>
  );
}
