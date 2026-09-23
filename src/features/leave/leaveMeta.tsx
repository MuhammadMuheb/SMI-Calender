import type { LucideIcon } from 'lucide-react';
import { CalendarOff, Palmtree, Stethoscope, Sparkles, Star, CalendarCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LeaveStatus, LeaveType } from '@/models/leave';
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '@/models/leave';

/**
 * One visual identity per leave type, reused by the calendar, badges and
 * legends. Colors come from the `--leave-*` tokens in index.css.
 */
export const LEAVE_TYPE_META: Record<LeaveType, {
  label: string;
  icon: LucideIcon;
  /** Solid swatch (calendar dots, legend). */
  dot: string;
  /** Soft chip: tinted background + readable text. */
  chip: string;
}> = {
  regular_day_off: {
    label: LEAVE_TYPE_LABELS.regular_day_off, icon: CalendarOff,
    dot: 'bg-leave-day-off', chip: 'bg-leave-day-off/12 text-leave-day-off',
  },
  paid_vacation: {
    label: LEAVE_TYPE_LABELS.paid_vacation, icon: Palmtree,
    dot: 'bg-leave-vacation', chip: 'bg-leave-vacation/12 text-leave-vacation',
  },
  sick_day: {
    label: LEAVE_TYPE_LABELS.sick_day, icon: Stethoscope,
    dot: 'bg-leave-sick', chip: 'bg-leave-sick/12 text-leave-sick',
  },
  auto_assigned: {
    label: LEAVE_TYPE_LABELS.auto_assigned, icon: Sparkles,
    dot: 'bg-leave-auto', chip: 'bg-leave-auto/15 text-muted-foreground',
  },
  auto_sunday: {
    label: LEAVE_TYPE_LABELS.auto_sunday, icon: CalendarCheck,
    dot: 'bg-leave-auto', chip: 'bg-leave-auto/15 text-muted-foreground',
  },
  special_day: {
    label: LEAVE_TYPE_LABELS.special_day, icon: Star,
    dot: 'bg-leave-special', chip: 'bg-leave-special/12 text-leave-special',
  },
};

export function leaveTypeMeta(type: LeaveType | string | undefined) {
  return LEAVE_TYPE_META[(type ?? 'regular_day_off') as LeaveType] ?? LEAVE_TYPE_META.regular_day_off;
}

const STATUS_CLASS: Record<LeaveStatus, string> = {
  pending: 'bg-warning/12 text-warning',
  approved: 'bg-success/12 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground line-through decoration-1',
};

/** Human label for a status; "rejected" reads as "Declined" to staff. */
export const STATUS_LABEL: Record<LeaveStatus, string> = {
  ...LEAVE_STATUS_LABELS,
  rejected: 'Declined',
};

export function LeaveStatusBadge({ status, className }: { status: LeaveStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('border-transparent', STATUS_CLASS[status] ?? STATUS_CLASS.pending, className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function LeaveTypeBadge({ type, className, withIcon = true }: {
  type: LeaveType | string; className?: string; withIcon?: boolean;
}) {
  const meta = leaveTypeMeta(type);
  const Icon = meta.icon;
  return (
    <Badge variant="secondary" className={cn('border-transparent', meta.chip, className)}>
      {withIcon && <Icon data-icon="inline-start" />}
      {meta.label}
    </Badge>
  );
}

/** Small colored dot for dense places like calendar cells. */
export function LeaveTypeDot({ type, className }: { type: LeaveType | string; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-1.5 rounded-full', leaveTypeMeta(type).dot, className)} />;
}

/** "Wed, Sep 23" */
export function formatShortDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
