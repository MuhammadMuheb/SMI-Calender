import type { ReactNode } from 'react';
import { theme } from '../../config/theme';

type BadgeColor = 'primary' | 'secondary' | 'gray' | 'success' | 'danger' | 'warning';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  size?: 'xs' | 'sm';
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  primary: { bg: theme.colors.primary + '22', text: theme.colors.primaryLight },
  secondary: { bg: theme.colors.secondary + '22', text: theme.colors.secondaryLight },
  gray: { bg: theme.colors.grayDarker, text: theme.colors.gray },
  success: { bg: theme.colors.success + '22', text: theme.colors.success },
  danger: { bg: theme.colors.danger + '22', text: theme.colors.danger },
  warning: { bg: theme.colors.warning + '22', text: theme.colors.warning },
};

export default function Badge({ children, color = 'primary', size = 'sm' }: BadgeProps) {
  const c = colorMap[color];
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`${sizeClass} rounded-md font-medium inline-flex items-center`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {children}
    </span>
  );
}
