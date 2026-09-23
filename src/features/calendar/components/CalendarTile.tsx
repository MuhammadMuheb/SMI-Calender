import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, CircleAlert, Flag, MapPin, Star, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DaySummary } from '@/models/calendar';
import type { LeaveType } from '@/models/leave';
import { leaveTypeMeta } from '@/features/leave/leaveMeta';

/** One person's approved leave, as shown inside a day cell. */
export interface CalendarTileLeave {
  id: string;
  name: string;
  /** `null` when the viewer may not see the leave type (a colleague's leave, seen by staff). */
  type: LeaveType | null;
  /** The signed-in user's own leave. */
  isYou?: boolean;
}

interface CalendarTileProps {
  day: number;
  dateStr: string;
  isToday?: boolean;
  isCurrentMonth?: boolean;
  isWeekend?: boolean;
  summary?: DaySummary | null;
  isUserOff?: boolean;
  /** Does anyone (including this user) have approved leave this day? */
  hasLeave?: boolean;
  hasScheduledGuides?: boolean;
  staffingLevel?: 'good' | 'exact' | 'low' | null;
  onClick?: () => void;
  /** Approved leave on this day. When given, the cell shows one marker per person. */
  leaves?: CalendarTileLeave[];
  /** The day currently shown in the day panel. */
  isSelected?: boolean;
  holidayName?: string;
  specialDayName?: string;
  /** First Sunday of the month (everyone off by default). */
  isFirstSunday?: boolean;
}

/** Hollow marker for leave whose type is private to the viewer. */
const PRIVATE_DOT = 'border border-foreground/45 bg-transparent';

const MAX_DOTS = 3;
const MAX_CHIPS = 3;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * A single day cell of the month grid.
 *
 * Phones: day number, one status icon and a row of leave dots.
 * Wider screens: holiday / special day names, one tinted chip per person
 * off (first name) and the scheduled tour-guide count.
 */
export default function CalendarTile({
  day, dateStr, isToday = false, isCurrentMonth = true, isWeekend = false,
  summary, isUserOff = false, hasLeave = false, hasScheduledGuides = false, staffingLevel = null, onClick,
  leaves, isSelected = false, holidayName, specialDayName, isFirstSunday = false,
}: CalendarTileProps) {
  const isHoliday = isCurrentMonth && (summary?.isHoliday ?? !!holidayName);
  const isSpecialDay = isCurrentMonth && (summary?.isSpecialDay ?? !!specialDayName);
  const guidesCount = isCurrentMonth && hasScheduledGuides ? (summary?.scheduledGuidesCount ?? 0) : 0;
  const showGuides = isCurrentMonth && hasScheduledGuides;

  // Fall back to a single neutral marker when the caller only knows "someone is off".
  const people: CalendarTileLeave[] = !isCurrentMonth
    ? []
    : leaves ?? (hasLeave ? [{ id: 'leave', name: isUserOff ? 'You' : 'Off', type: null, isYou: isUserOff }] : []);
  const offCount = leaves ? leaves.length : (summary?.approvedLeaves ?? people.length);

  // Status icons, most important first. Phones show only the first one.
  const icons: { key: string; Icon: LucideIcon; className: string }[] = [];
  if (isCurrentMonth && staffingLevel === 'low') icons.push({ key: 'low', Icon: TriangleAlert, className: 'text-warning' });
  if (isHoliday) icons.push({ key: 'holiday', Icon: Flag, className: 'text-info' });
  if (isSpecialDay) icons.push({ key: 'special', Icon: Star, className: 'fill-current text-leave-special' });
  if (isCurrentMonth && staffingLevel === 'exact') icons.push({ key: 'exact', Icon: CircleAlert, className: 'text-muted-foreground' });
  if (isCurrentMonth && isFirstSunday) icons.push({ key: 'sunday', Icon: CalendarCheck, className: 'text-muted-foreground' });

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const youOff = isUserOff || people.some((p) => p.isYou);
  const othersOff = offCount - (youOff ? 1 : 0);
  const a11yLabel = [
    dateLabel,
    isToday ? 'today' : null,
    isHoliday ? (holidayName ?? 'holiday') : null,
    isSpecialDay ? (specialDayName ?? 'special day') : null,
    youOff ? 'you are off' : null,
    othersOff > 0 ? `${othersOff} ${othersOff === 1 ? 'person' : 'people'} off` : null,
    !youOff && othersOff <= 0 && hasLeave ? 'someone is off' : null,
    showGuides ? 'tour guides scheduled' : null,
    isCurrentMonth && staffingLevel === 'low' ? 'short-staffed' : null,
    isCurrentMonth && staffingLevel === 'exact' ? 'at minimum staffing' : null,
  ].filter(Boolean).join(', ');

  const extraDots = people.length - MAX_DOTS;
  const extraChips = people.length - MAX_CHIPS;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isCurrentMonth}
      data-date={dateStr}
      aria-label={a11yLabel}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'relative flex min-h-14 min-w-0 flex-col gap-1 border-r border-b p-1 text-left transition-colors outline-none nth-[7n]:border-r-0 sm:min-h-24 sm:p-1.5 lg:min-h-28',
        'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        isCurrentMonth ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default bg-muted/40',
        isHoliday && 'bg-info/6 hover:bg-info/10',
        isSpecialDay && !isHoliday && 'bg-leave-special/6 hover:bg-leave-special/10',
        isSelected && isCurrentMonth && 'bg-primary/8 hover:bg-primary/12 inset-ring-1 inset-ring-primary/30',
      )}
    >
      <div aria-hidden="true" className="flex items-start justify-between gap-0.5">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums sm:size-7 sm:text-sm',
            !isCurrentMonth && 'text-muted-foreground/50',
            isCurrentMonth && isWeekend && 'text-muted-foreground',
            isHoliday && 'text-info',
            isToday && 'font-semibold text-primary ring-[1.5px] ring-primary',
          )}
        >
          {day}
        </span>
        {icons.length > 0 && (
          <span className="flex items-center gap-0.5 pt-0.5">
            {icons.map(({ key, Icon, className }, i) => (
              <Icon key={key} className={cn('size-3 sm:size-3.5', className, i > 0 && 'hidden sm:block')} />
            ))}
          </span>
        )}
      </div>

      {/* Phones: dots */}
      {(people.length > 0 || showGuides) && (
        <div aria-hidden="true" className="mt-auto flex flex-wrap items-center gap-0.5 px-0.5 sm:hidden">
          {showGuides && <MapPin className="size-2.5 text-primary" />}
          {people.slice(0, MAX_DOTS).map((p) => (
            <span
              key={p.id}
              className={cn('inline-block size-1.5 rounded-full', p.type ? leaveTypeMeta(p.type).dot : PRIVATE_DOT)}
            />
          ))}
          {extraDots > 0 && <span className="text-[9px] leading-none text-muted-foreground tabular-nums">+{extraDots}</span>}
        </div>
      )}

      {/* Wider screens: names */}
      <div aria-hidden="true" className="hidden min-w-0 flex-1 flex-col gap-0.5 sm:flex">
        {isHoliday && holidayName && (
          <span className="truncate text-[11px] leading-4 font-medium text-info">{holidayName}</span>
        )}
        {isSpecialDay && specialDayName && (
          <span className="truncate text-[11px] leading-4 font-medium text-leave-special">{specialDayName}</span>
        )}
        {people.slice(0, MAX_CHIPS).map((p) => (
          <span
            key={p.id}
            className={cn(
              'flex min-w-0 items-center gap-1 rounded-sm px-1 text-[11px] leading-4 font-medium',
              p.type ? leaveTypeMeta(p.type).chip : 'bg-muted text-muted-foreground',
            )}
          >
            {!p.type && <span className={cn('size-1.5 shrink-0 rounded-full', PRIVATE_DOT)} />}
            <span className="truncate">{p.isYou ? 'You' : firstName(p.name)}</span>
          </span>
        ))}
        {extraChips > 0 && (
          <span className="px-1 text-[11px] leading-4 text-muted-foreground tabular-nums">+{extraChips} more</span>
        )}
        {showGuides && (
          <span className="mt-auto flex items-center gap-1 px-0.5 text-[11px] leading-4 text-muted-foreground">
            <MapPin className="size-3 shrink-0 text-primary" />
            <span className="truncate tabular-nums">
              {guidesCount > 0 ? `${guidesCount} ${guidesCount === 1 ? 'guide' : 'guides'}` : 'Guides'}
            </span>
          </span>
        )}
      </div>
    </button>
  );
}
