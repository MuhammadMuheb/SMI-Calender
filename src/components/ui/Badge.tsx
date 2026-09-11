import type { ReactNode } from 'react';
import { theme } from '../../config/theme';

type BadgeColor = 'primary' | 'secondary' | 'gray' | 'success' | 'danger' | 'warning';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  size?: 'xs' | 'sm';
}

/**
 * Colors resolve through theme.badge.* CSS variable tokens (see index.css),
 * which are deliberately different per theme: soft/translucent on the dark
 * near-black surface, solid/rich on the light surface — a flat translucent
 * tint reads as washed-out on white instead of professional.
 */
export default function Badge({ children, color = 'primary', size = 'sm' }: BadgeProps) {
  const c = theme.badge[color];
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`${sizeClass} rounded-md font-semibold inline-flex items-center`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {children}
    </span>
  );
}
