import type { ReactNode } from 'react';
import { theme } from '../../config/theme';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  padding?: boolean;
  className?: string;
}

export default function Card({
  children,
  title,
  subtitle,
  padding = true,
  className = '',
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${padding ? 'p-4' : ''} ${className}`}
      style={{
        backgroundColor: theme.colors.bgElevated,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold" style={{ color: theme.colors.white }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: theme.colors.grayDark }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
