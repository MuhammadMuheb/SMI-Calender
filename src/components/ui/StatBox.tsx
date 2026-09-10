import { theme } from '../../config/theme';
import type { ReactNode } from 'react';

interface StatBoxProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export default function StatBox({ label, value, sub, color, icon, onClick }: StatBoxProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: theme.colors.bgElevated,
        border: `1px solid ${theme.colors.border}`,
        height: 96,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.colors.grayDark }}>{label}</p>
          <p className="text-2xl font-bold" style={{ color: color ?? theme.colors.white }}>{value}</p>
          {sub ? (
            <p className="text-[9px] mt-0.5" style={{ color: theme.colors.grayDark }}>{sub}</p>
          ) : (
            <p className="text-[9px] mt-0.5">&nbsp;</p>
          )}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (color ?? theme.colors.primary) + '18', color: color ?? theme.colors.primary }}>
            {icon}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
