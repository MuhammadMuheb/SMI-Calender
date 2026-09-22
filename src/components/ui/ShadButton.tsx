import * as React from "react"

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const getVariantClasses = (variant: ButtonVariant = 'default'): string => {
  const variants: Record<ButtonVariant, string> = {
    default: 'bg-emerald-600 text-white hover:bg-emerald-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white',
    secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
    ghost: 'text-white hover:bg-slate-800',
    link: 'text-emerald-400 underline-offset-4 hover:underline',
  };
  return variants[variant] || variants.default;
};

const getSizeClasses = (size: ButtonSize = 'default'): string => {
  const sizes: Record<ButtonSize, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-xs',
    lg: 'h-11 px-8 text-base',
    icon: 'h-10 w-10',
  };
  return sizes[size] || sizes.default;
};

export interface ShadButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const ShadButton = React.forwardRef<HTMLButtonElement, ShadButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50';
    const variantClasses = getVariantClasses(variant);
    const sizeClasses = getSizeClasses(size);
    const finalClassName = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`;

    return (
      <button
        className={finalClassName}
        ref={ref}
        {...props}
      />
    );
  }
);

ShadButton.displayName = "Button"

export { ShadButton }
