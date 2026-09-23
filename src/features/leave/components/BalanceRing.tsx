import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type BalanceTone = 'day-off' | 'vacation' | 'sick' | 'primary';

const TONE_BAR: Record<BalanceTone, string> = {
  'day-off': '*:data-[slot=progress-indicator]:bg-leave-day-off',
  vacation: '*:data-[slot=progress-indicator]:bg-leave-vacation',
  sick: '*:data-[slot=progress-indicator]:bg-leave-sick',
  primary: '*:data-[slot=progress-indicator]:bg-primary',
};

interface BalanceRingProps {
  label: string;
  /** Unit shown after the total, e.g. "days". */
  sublabel: string;
  remaining: number;
  total: number;
  /** Bar color. Defaults to the regular day-off color. */
  tone?: BalanceTone;
  /** Optional small line under the bar, e.g. "2 used". */
  hint?: string;
  className?: string;
  /** @deprecated Colors come from `tone`; kept so older callers still compile. */
  color?: string;
  /** @deprecated The readout sizes to its container. */
  size?: number;
}

/**
 * Compact balance readout: the number of days left, what it is out of, and a
 * slim bar that is full when the whole allowance is still available.
 * (Named for the ring it replaced; the export stays for existing imports.)
 */
export default function BalanceRing({
  label, sublabel, remaining, total, tone = 'day-off', hint, className,
}: BalanceRingProps) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-3xl font-semibold tracking-tight tabular-nums', remaining < 0 && 'text-destructive')}>
          {remaining}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">of {total} {sublabel} left</span>
      </div>
      <Progress
        value={pct}
        className={cn('h-1.5', TONE_BAR[tone])}
        aria-label={`${label}: ${remaining} of ${total} ${sublabel} left`}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
