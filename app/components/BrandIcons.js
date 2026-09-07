/**
 * Brand icon set — small inline SVGs shared by the marketing pages and
 * the admin panel. Every icon is a 24x24 viewBox so callers can size it
 * with `width` / `height` (or `font-size` for `currentColor`).
 *
 * Keep this file dependency-free and side-effect free so it works in
 * both server and client components AND in pure-Node test runs
 * (no transpiler required — we use React.createElement instead of JSX).
 *
 * Add new icons by extending ICONS below — never edit the call sites.
 */
import React from 'react'

const PATHS = {
  hair: [
    React.createElement('path', { key: 'h1', d: 'M6 4 C 8 8, 8 12, 6 16 C 4 19, 4 21, 6 22', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('path', { key: 'h2', d: 'M12 3 C 14 7, 14 13, 12 18 C 10 21, 10 22, 12 23', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('path', { key: 'h3', d: 'M18 4 C 16 8, 16 12, 18 16 C 20 19, 20 21, 18 22', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  scissors: [
    React.createElement('circle', { key: 's1', cx: '6', cy: '7', r: '2.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
    React.createElement('circle', { key: 's2', cx: '6', cy: '17', r: '2.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
    React.createElement('line', { key: 's3', x1: '8', y1: '9', x2: '20', y2: '20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 's4', x1: '8', y1: '15', x2: '20', y2: '4', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  comb: [
    React.createElement('path', { key: 'c1', d: 'M3 8 L 21 8', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('path', { key: 'c2', d: 'M3 12 L 21 12', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 'c3', x1: '6', y1: '8', x2: '6', y2: '20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 'c4', x1: '10', y1: '8', x2: '10', y2: '20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 'c5', x1: '14', y1: '8', x2: '14', y2: '20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 'c6', x1: '18', y1: '8', x2: '18', y2: '20', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  drop: [
    React.createElement('path', { key: 'd1', d: 'M12 3 C 8 8, 6 12, 6 15 a 6 6 0 0 0 12 0 C 18 12, 16 8, 12 3 Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinejoin: 'round' }),
  ],
  spark: [
    React.createElement('path', { key: 'sp1', d: 'M12 3 L 13.5 9 L 19.5 10.5 L 13.5 12 L 12 18 L 10.5 12 L 4.5 10.5 L 10.5 9 Z', fill: 'currentColor', opacity: '0.18' }),
    React.createElement('path', { key: 'sp2', d: 'M12 3 L 13.5 9 L 19.5 10.5 L 13.5 12 L 12 18 L 10.5 12 L 4.5 10.5 L 10.5 9 Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinejoin: 'round' }),
  ],
  leaf: [
    React.createElement('path', { key: 'l1', d: 'M5 19 C 5 9, 12 4, 20 4 C 20 12, 15 19, 5 19 Z', fill: 'currentColor', opacity: '0.12' }),
    React.createElement('path', { key: 'l2', d: 'M5 19 C 5 9, 12 4, 20 4 C 20 12, 15 19, 5 19 Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinejoin: 'round' }),
    React.createElement('path', { key: 'l3', d: 'M5 19 L 14 10', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  calendar: [
    React.createElement('rect', { key: 'ca1', x: '3', y: '5', width: '18', height: '16', rx: '2', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
    React.createElement('line', { key: 'ca2', x1: '3', y1: '10', x2: '21', y2: '10', stroke: 'currentColor', strokeWidth: '1.5' }),
    React.createElement('line', { key: 'ca3', x1: '8', y1: '3', x2: '8', y2: '7', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
    React.createElement('line', { key: 'ca4', x1: '16', y1: '3', x2: '16', y2: '7', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  chat: [
    React.createElement('path', { key: 'ch1', d: 'M4 5 H 20 a 2 2 0 0 1 2 2 v 10 a 2 2 0 0 1 -2 2 H 9 l -5 4 V 7 a 2 2 0 0 1 2 -2 Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinejoin: 'round' }),
  ],
  shield: [
    React.createElement('path', { key: 'sh1', d: 'M12 3 L 20 6 V 12 C 20 17, 16 20, 12 22 C 8 20, 4 17, 4 12 V 6 Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinejoin: 'round' }),
  ],
  clock: [
    React.createElement('circle', { key: 'cl1', cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
    React.createElement('path', { key: 'cl2', d: 'M12 7 V 12 L 15 14', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  ],
  arrow: [
    React.createElement('path', { key: 'a1', d: 'M5 12 H 19 M 14 7 L 19 12 L 14 17', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }),
  ],
}

const ICONS = PATHS

export const BRAND_ICON_NAMES = Object.keys(PATHS)

/**
 * Map a service category to a default icon. Keep the mapping small and
 * forgiving — unknown categories fall back to `scissors`.
 */
export function iconForCategory(category) {
  if (!category) return 'scissors'
  const c = String(category).toLowerCase()
  if (c.includes('colour') || c.includes('染')) return 'drop'
  if (c.includes('perm') || c.includes('電')) return 'spark'
  if (c.includes('treat') || c.includes('護理') || c.includes('護')) return 'leaf'
  if (c.includes('cut') || c.includes('剪')) return 'scissors'
  if (c.includes('blow') || c.includes('造型')) return 'comb'
  return 'scissors'
}

export default function BrandIcon({ name, size = 24, label, className = '' }) {
  const content = ICONS[name] || ICONS.scissors
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      className: `brand-icon ${className}`.trim(),
      ...a11y,
    },
    ...content,
  )
}

export const __testing = { PATHS, iconForCategory, BRAND_ICON_NAMES }
