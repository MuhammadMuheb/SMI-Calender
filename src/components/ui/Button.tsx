import type { ReactNode, MouseEventHandler } from 'react';
import { theme } from '../../config/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit';
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: theme.colors.primary, color: theme.colors.white },
  secondary: { backgroundColor: theme.colors.secondary, color: theme.colors.white },
  outline: {
    border: `1px solid ${theme.colors.grayDarker}`,
    color: theme.colors.gray,
    backgroundColor: 'transparent',
  },
  ghost: { color: theme.colors.gray, backgroundColor: 'transparent' },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  onClick,
  disabled,
  icon,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.97] cursor-pointer ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-40 !cursor-not-allowed' : ''}`}
      style={variantStyles[variant]}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
