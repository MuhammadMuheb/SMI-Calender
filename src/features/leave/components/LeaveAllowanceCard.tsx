import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AllowanceTone = 'taken' | 'booked' | 'remaining';

export interface AllowanceSegment {
  /** e.g. 'taken', 'booked', 'remaining' */
  label: string;
  value: number;
  /** Which part of the allowance this is. Inferred from `label` (or position) when omitted. */
  tone?: AllowanceTone;
  /** @deprecated Colors come from `tone`; kept so older callers still compile. */
  color?: string;
}

interface LeaveAllowanceCardProps {
  title: string;
  /** Small text on the top-right, e.g. "Week 2 of 4" or "never expires" */
  subtitle?: string;
  segments: AllowanceSegment[];
  unit?: string;
  /** Optional one-line note under the stats, e.g. auto-Sunday consumption */
  footnote?: string;
  /** Emphasizes the footnote (any value). Kept for older callers. */
  footnoteColor?: string;
  className?: string;
}

const TONE_BAR: Record<AllowanceTone, string> = {
  taken: 'bg-muted-foreground/60',
  booked: 'bg-warning',
  remaining: 'bg-primary',
};

const TONE_ORDER: AllowanceTone[] = ['taken', 'booked', 'remaining'];

function toneOf(seg: AllowanceSegment, index: number): AllowanceTone {
  if (seg.tone) return seg.tone;
  const label = seg.label.toLowerCase();
  const match = TONE_ORDER.find((t) => label.includes(t));
  return match ?? TONE_ORDER[Math.min(index, TONE_ORDER.length - 1)];
}

function sentenceCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One leave allowance (regular days off, vacation): the days still free as a
 * big number, a segmented bar of taken / booked / remaining, and the numbers
 * behind it. Same shape for every leave type across every role.
 */
export default function LeaveAllowanceCard({
  title, subtitle, segments, unit = 'days', footnote, footnoteColor, className,
}: LeaveAllowanceCardProps) {
  const parts = segments.map((seg, i) => ({ ...seg, tone: toneOf(seg, i) }));
  const total = parts.reduce((sum, seg) => sum + Math.max(0, seg.value), 0);
  const remaining = parts.find((p) => p.tone === 'remaining') ?? parts[parts.length - 1];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{sentenceCase(subtitle)}</CardDescription>}
        {remaining && (
          <CardAction className="text-right">
            <div className="text-4xl leading-none font-semibold tracking-tight tabular-nums">{remaining.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{unit} left</div>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div
          role="img"
          aria-label={parts.map((p) => `${p.value} ${p.label}`).join(', ')}
          className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {total > 0 && parts.map((seg, i) => seg.value > 0 && (
            <div
              key={i}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_BAR[seg.tone])}
              style={{ width: `${(seg.value / total) * 100}%` }}
            />
          ))}
        </div>

        <dl className="grid auto-cols-fr grid-flow-col gap-2">
          {parts.map((seg, i) => (
            <div key={i} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_BAR[seg.tone])} />
                {sentenceCase(seg.label)}
              </dt>
              <dd className="mt-0.5 text-base font-medium tabular-nums">
                {seg.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        {footnote && (
          <p className={cn(
            'border-t pt-3 text-xs',
            footnoteColor ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}>
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
