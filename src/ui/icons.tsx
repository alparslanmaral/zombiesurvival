/**
 * Hand-drawn SVG icon set (24×24, stroke-based, currentColor). Replaces emoji
 * everywhere. Icons are static, trusted markup strings rendered into a <g>.
 */
import type { CSSProperties } from 'react';

const P = (d: string) => `<path d="${d}"/>`;
const C = (cx: number, cy: number, r: number, fill = false) => `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ' fill="currentColor" stroke="none"' : ''}/>`;

export const ICONS: Record<string, string> = {
  // ---------------------------------------------------------------- cells
  safe: P('M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z') + P('M9 8.5v7M15 8.5v7M9 12h6'),
  start: P('M3 21h18') + P('M4 21V11h4v10M8 21V6h5v15M13 21v-8h4v8M17 21V9h3v12') + P('M10 9h1M10 12h1M10 15h1'),
  loot: P('M3.5 8 12 4l8.5 4v8.5L12 21l-8.5-4.5z') + P('M3.5 8 12 12.5 20.5 8M12 12.5V21') + P('M7.7 6 16.2 10.3'),
  zombie: P('M7 10.5a5 5 0 0 1 10 0v2.8l-1.2 1.4V17H8.2v-2.3L7 13.3z') + C(9.8, 11.2, 1.1, true) + C(14.2, 11.2, 1.1, true) + P('M10.5 17v2M13.5 17v2M12 14.2v.8'),
  horde:
    P('M2.5 12a3.6 3.6 0 0 1 7.2 0v2l-.9 1v1.5H3.4V15l-.9-1z') +
    P('M14.3 12a3.6 3.6 0 0 1 7.2 0v2l-.9 1v1.5h-5.4V15l-.9-1z') +
    P('M7.6 8a4.4 4.4 0 0 1 8.8 0v2.6l-1.1 1.2v2H8.7v-2l-1.1-1.2z') +
    C(10.3, 8.8, 0.9, true) + C(13.7, 8.8, 0.9, true) + P('M3 20.5h18'),
  event: P('M12 3 2.5 20h19z') + P('M12 9.5v5') + C(12, 17.2, 0.6, true),
  shelter: P('M3 11 12 4l9 7') + P('M5 9.5V20h14V9.5') + P('M10 20v-5.5h4V20') + P('M12 8.3v.1'),
  blocked: P('M3 8h18v4H3zM3 14h18v4H3z') + P('M6 8l4 4M12 8l4 4M6 14l4 4M12 14l4 4') + P('M5 18v3M19 18v3'),
  ruin: P('M3 21h18') + P('M5 21v-9l3-2v-4l4 2 2-3v9l3 1 2-2v8') + P('M8 14h2M14 16h1'),
  cleared: P('M5 19 19 5') + P('M5 15.5a2 2 0 1 1-1.5-3.3M8.5 19a2 2 0 1 1 3.3-1.5') + P('M19 8.5a2 2 0 1 1 1.5 3.3M15.5 5a2 2 0 1 1-3.3 1.5'),
  empty: P('M4 18c3-1.5 5-1.5 8 0s5 1.5 8 0') + P('M6 12h.01M12 10h.01M17 13h.01'),

  // ---------------------------------------------------------------- classes
  scout: C(12, 12, 9) + P('M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z') + P('M12 3v2M12 19v2M3 12h2M19 12h2'),
  scavenger: P('M6 9a6 6 0 0 1 12 0v11H6z') + P('M9 9V7a3 3 0 0 1 6 0v2') + P('M8.5 13h7v4h-7z') + P('M12 13v4'),
  guardian: P('M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z') + P('M12 6v12M7.5 10.5h9'),
  medic: P('M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'),
  engineer: P('M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a2 2 0 0 0 2.8 2.8l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.4-.4-2.4z'),

  // ---------------------------------------------------------------- items
  rebar: P('M5 19 19 5') + P('M7 17l-2-1M9 15l-1.5-2M11 13l-1-2.3M13 11l-.5-2.5M15 9l0-2.5M17 7l.5-2'),
  knife: P('M4 20 14 10') + P('M14 10c2-2 4.5-5 6-7-1 3-3.2 6.5-5 8.5z') + P('M6.5 15.5l2 2'),
  axe: P('M5 21 15 8') + P('M13.5 5.5c2.5-2.5 5.5-2 7 0-1.5 2.5-4.5 4-6.5 4z'),
  machete: P('M4 20l3-3') + P('M7 17 18.5 5.5c1.2-1.2 2.3.2 1.6 1.6C17 12 12 16 8.5 18.5z') + P('M5.5 15.5l3 3'),
  nailgun: P('M3 9h13l3 2v3H9l-1 6H4l1-6H3z') + P('M19 12.5h2.5') + P('M11 14v2'),
  shotgun: P('M2 10h14l6-1.5v3L16 13H9l-2 6H4l1.5-6H2z') + P('M10 13l1 2'),
  jacket: P('M8 3 4 6l-1.5 6L5 13v8h14v-8l2.5-1L20 6l-4-3-4 3z') + P('M12 6v15'),
  leathers: P('M8 3 4 6l-1.5 6L5 13v8h14v-8l2.5-1L20 6l-4-3-4 3z') + P('M9 7l6 7M8 12h3'),
  riotvest: P('M7 3h10l2 3v15H5V6z') + P('M9 3v4h6V3') + P('M8 11h8M8 15h8'),
  shoes: P('M3 16V9l4 1 3 3 5 1.5c3 .7 5 1.7 6 3.5v1H3z') + P('M3 19h18') + P('M8 11.5l1-1.5M10.5 13l1-1.5'),
  crowbar: P('M7 20 17 6') + P('M17 6c.5-2 3-3 4-1.5') + P('M7 20c-1.2.6-2.6-.6-2-2l1-1'),
  flashlight: P('M8 3h8v5l-2 3v10h-4V11L8 8z') + P('M8 8h8') + P('M12 14v2') + P('M5 3 3 1M19 3l2-2M12 1V0'),
  hook: P('M12 2v9') + P('M12 11a6 6 0 1 0 6 6') + P('M18 17l2.5-2.5M12 11l-3 2') + P('M10 4h4'),
  lockpicks: C(8, 8, 4) + P('M11 11l9 9M16 16l2-2M18.5 18.5l1.5-1.5'),
  gasmask: P('M6 9c0-3 2.7-5 6-5s6 2 6 5v4c0 3-2.7 5-6 5s-6-2-6-5z') + C(9.3, 10, 1.6) + C(14.7, 10, 1.6) + P('M10 15h4v4h-4z') + P('M6 12H3M18 12h3'),
  bandages: P('M4.5 15.5 15.5 4.5a3.5 3.5 0 0 1 5 5L9.5 20.5a3.5 3.5 0 0 1-5-5z') + P('M9 11l4 4M11 9.5l.01.01M13 11.5l.01.01M11.5 13l.01.01'),
  firstaid: P('M3 8h18v12H3z') + P('M9 8V5h6v3') + P('M12 11v6M9 14h6'),
  painkillers: P('M7 8h10v13H7z') + P('M6 4h12v4H6z') + P('M9.5 14.5h5M12 12v5'),
  adrenaline: P('M14 3l7 7') + P('M17.5 6.5 8 16l-3-3 9.5-9.5') + P('M8 16l-1.5 1.5M5 13l-1.5 1.5M6.5 17.5 3 21') + P('M10 11l1 1M12 9l1 1'),
  molotov: P('M9 10h6v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z') + P('M10 10V7h4v3') + P('M12 7V5') + P('M12 5c-1.5-1-1.5-3 0-4 0 1.5 2 1.5 1 3.5'),
  smoke: P('M6 17a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5 3.3 3.3 0 0 1 0 6.5z') + P('M4 21h16M7 19.5h10'),
  pipebomb: P('M5 9h12v8H5z') + P('M5 11h12M5 15h12') + P('M17 13h2c1 0 1.5-1 2-2.5') + P('M21 10.5l1-1M21.5 11.8l1.5.2'),

  // ---------------------------------------------------------------- events
  radiation: C(12, 12, 1.8, true) + P('M12 9.5 9 4.3a8 8 0 0 0-4 6.9h6M12 9.5l3-5.2a8 8 0 0 1 4 6.9h-6M10.8 14.1l-3 5.2a8 8 0 0 0 8.4 0l-3-5.2'),
  depot: P('M3 10 12 4l9 6v11H3z') + P('M7 21v-8h10v8') + P('M7 16h10M7 18.5h10'),
  ambush: P('M6 4c1 5 1 10-1 16M11 3c1 6 1 12-1 18M16 4c1 5 1 10-1 16') + P('M18.5 6.5c.8 4 .8 8-.5 12'),
  tunnel: P('M3 21V12a9 9 0 0 1 18 0v9') + P('M7 21v-8a5 5 0 0 1 10 0v8') + P('M3 21h18') + P('M12 15v6'),
  stranger: P('M4 13.5 8 10l3 1 5-5 1.5 1.5-4 4.5h5l1 2-6 3H8l-4 2') + P('M15 4.5l1.5-1.5'),
  collapse: P('M3 4h18') + P('M8 4l2 4-3 3 4 3-2 3 3 3') + P('M3 20h18'),
  radio: P('M4 9h16v12H4z') + P('M7 9l10-6') + C(9.5, 15, 2.5) + P('M15 13h2M15 16h2'),
  dogs: C(6, 10, 1.8) + C(10, 6.5, 1.8) + C(14, 6.5, 1.8) + C(18, 10, 1.8) + P('M12 11c-3 0-5.5 4-5.5 6.5 0 2 2 2.5 3.5 2 1-.3 1.3-.6 2-.6s1 .3 2 .6c1.5.5 3.5 0 3.5-2 0-2.5-2.5-6.5-5.5-6.5z'),

  // ---------------------------------------------------------------- ui
  heart: P('M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6-8.5 11-8.5 11z'),
  wave: P('M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0') + P('M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0') + P('M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0'),
  map: P('M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z') + P('M9 4v13.5M15 6.5V20'),
  pack: P('M6 9a6 6 0 0 1 12 0v11H6z') + P('M9 9V7a3 3 0 0 1 6 0v2') + P('M6 14h12'),
  log: P('M6 3h10l3 3v15H6z') + P('M9 9h7M9 13h7M9 17h4'),
  squad: C(9, 8, 3) + P('M3 20a6 6 0 0 1 12 0') + C(17, 9, 2.4) + P('M16 14a5 5 0 0 1 5.5 5'),
  fight: P('M4 4l9 9M20 4l-9 9') + P('M4 4h3v3M20 4h-3v3') + P('M8.5 13.5 5 17l2 2 3.5-3.5M15.5 13.5 19 17l-2 2-3.5-3.5'),
  flee: C(14, 4.5, 1.8) + P('M9 9.5 12 8l3 2 2.5 3') + P('M12 8l-1.5 6 3.5 2.5-1 5M10.5 14l-3 3.5H4') + P('M3 9h4M2 12h4'),
  hide: P('M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z') + C(12, 12, 2.5) + P('M4 4l16 16'),
  team: C(8, 7.5, 2.6) + C(16, 7.5, 2.6) + P('M3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0'),
  wait: P('M7 3h10M7 21h10') + P('M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9'),
  arrow: P('M4 12h15') + P('M13 6l6 6-6 6'),
  ko: P('M4 6h6l-6 7h6') + P('M13 11h5l-5 6h5') + P('M17 3h3l-3 3.5h3'),
  winded: P('M3 9h10a3 3 0 1 0-3-3') + P('M3 13h15a3 3 0 1 1-3 3') + P('M3 17h7'),
  slipped: P('M4 18c4 0 5-12 10-12h6') + P('M16 3l4 3-4 3') + P('M4 13h3M4 9h5'),
  engaged: P('M4 4l9 9M20 4l-9 9') + P('M8.5 13.5 5 17l2 2 3.5-3.5M15.5 13.5 19 17l-2 2-3.5-3.5'),
  bolt: P('M13 2 4 14h7l-1 8 9-12h-7z'),
  star: P('M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6-4.5-4.1 6-.7z'),
  dice: P('M4 4h16v16H4z') + C(8.5, 8.5, 1.1, true) + C(15.5, 15.5, 1.1, true) + C(12, 12, 1.1, true),
  flag: P('M5 21V3') + P('M5 4h12l-2.5 4L17 12H5'),
  skull: P('M5 11a7 7 0 0 1 14 0v3l-2 2v3H7v-3l-2-2z') + C(9, 12, 1.6, true) + C(15, 12, 1.6, true) + P('M12 15v1.5'),
  link: P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1') + P('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  back: P('M20 12H5') + P('M11 6l-6 6 6 6'),
  check: P('M4 12.5l5 5L20 6.5'),
  craft: P('M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a2 2 0 0 0 2.8 2.8l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.4-.4-2.4z') + P('M19 15v6M16 18h6'),
  emblem: P('M12 2.5 20.5 7.3v9.4L12 21.5 3.5 16.7V7.3z') + P('M9.2 18.5 11.2 7.5M14.8 18.5 12.8 7.5') + P('M12 17v-1.6M12 13.4v-1.2M12 10.4v-.8') + P('M6.5 15.5l2-1M17.5 15.5l-2-1'),
  biohazard: C(12, 12, 2.2) + P('M12 9.8V7a3.8 3.8 0 1 1-3.3 5.6M14.2 12.6a3.8 3.8 0 1 1-6.2.8M9.8 12.6a3.8 3.8 0 1 1 6.6-1.8') + P('M12 3.5a4 4 0 0 0-2 .6M19 15.5a4 4 0 0 0 1-1.8M5 15.5a4 4 0 0 1-1-1.8'),
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  title?: string;
}

/** Standalone <svg> icon for HTML contexts. */
export function Icon({ name, size = 20, className, style, strokeWidth = 1.8, title }: IconProps) {
  const markup = ICONS[name] ?? ICONS.event;
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g dangerouslySetInnerHTML={{ __html: markup as string }} />
    </svg>
  );
}

/** Icon as a <g> for use inside another <svg> (e.g. the hex map). Centered at (x, y). */
export function IconG({ name, x, y, size, className, strokeWidth = 1.8 }: { name: string; x: number; y: number; size: number; className?: string; strokeWidth?: number }) {
  const markup = ICONS[name] ?? ICONS.event;
  const k = size / 24;
  return (
    <g
      className={className}
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: markup as string }}
    />
  );
}

/** Rotation (degrees) of the right-pointing arrow for each hex direction (pointy-top). */
export const DIR_ANGLE: Record<string, number> = { E: 0, SE: 60, SW: 120, W: 180, NW: 240, NE: 300 };
