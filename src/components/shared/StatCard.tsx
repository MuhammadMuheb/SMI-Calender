import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'primary' | 'warning' | 'destructive' | 'info';

const toneText: Record<StatTone, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
};

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  /** Colors the value only; surfaces stay neutral. */
  tone?: StatTone;
  onClick?: () => void;
  className?: string;
}

/** A single metric. Becomes a button when `onClick` is given. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', onClick, className }: StatCardProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground',
        onClick && 'transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          {Icon && <Icon className="size-4" aria-hidden="true" />}
          {label}
        </span>
        {onClick && (
          <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        )}
      </div>
      <div>
        <div className={cn('text-3xl font-semibold tracking-tight tabular-nums', toneText[tone])}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Comp>
  );
}
