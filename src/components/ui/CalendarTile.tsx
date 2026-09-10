import { theme } from '../../config/theme';
import type { DaySummary } from '../../models/calendar';

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
  staffingLevel?: 'good' | 'exact' | 'low' | null;
  onClick?: () => void;
}

/**
 * A single, compact day cell: date number + one small dot when the day has
 * approved leave on it (green — someone else, red — this user). Per-person
 * detail lives in the day panel below the grid, not in the cell itself.
 */
export default function CalendarTile({
  day, dateStr, isToday, isCurrentMonth = true, isWeekend,
  summary, isUserOff = false, hasLeave = false, staffingLevel = null, onClick,
}: CalendarTileProps) {
  const isHoliday = summary?.isHoliday ?? false;
  const isSpecialDay = summary?.isSpecialDay ?? false;

  let bg: string = theme.colors.bgElevated;
  let borderColor: string = theme.colors.border;
  let borderWidth: string = '1px';

  if (isToday) {
    bg = theme.colors.primary + '20';
    borderColor = theme.colors.primary;
    borderWidth = '1.5px';
  } else if (isHoliday) {
    bg = theme.colors.secondary + '12';
    borderColor = theme.colors.secondary + '40';
  } else if (isSpecialDay) {
    bg = theme.colors.warning + '10';
    borderColor = theme.colors.warning + '40';
  } else if (isCurrentMonth && staffingLevel === 'low') {
    borderColor = theme.colors.danger + '50';
  } else if (isCurrentMonth && staffingLevel === 'exact') {
    borderColor = theme.colors.warning + '40';
  }

  let dateColor: string = theme.colors.white;
  if (!isCurrentMonth) {
    dateColor = theme.colors.grayDarker;
  } else if (isUserOff) {
    dateColor = theme.colors.secondary;
  } else if (isToday) {
    dateColor = theme.colors.primaryLight;
  } else if (isHoliday) {
    dateColor = theme.colors.secondary;
  } else if (isWeekend) {
    dateColor = theme.colors.grayDark;
  }

  const dotColor = isUserOff ? theme.colors.secondary : theme.colors.primary;

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const a11yLabel = [
    dateLabel,
    isToday ? 'today' : null,
    isUserOff ? 'you are off' : hasLeave ? 'someone is off' : null,
  ].filter(Boolean).join(', ');

  return (
    <button type="button" onClick={onClick} disabled={!isCurrentMonth} data-date={dateStr}
      aria-label={a11yLabel}
      className={`rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-95 h-11 ${isCurrentMonth ? 'cursor-pointer' : 'opacity-30 cursor-default'}`}
      style={{ backgroundColor: bg, border: `${borderWidth} solid ${borderColor}` }}>
      <span className="text-[11px] font-semibold leading-none"
        style={{ color: dateColor, fontWeight: isUserOff && isCurrentMonth ? 800 : 600 }}>
        {day}
      </span>
      <span aria-hidden="true" className="w-1 h-1 rounded-full" style={{ backgroundColor: isCurrentMonth && hasLeave ? dotColor : 'transparent' }} />
    </button>
  );
}
