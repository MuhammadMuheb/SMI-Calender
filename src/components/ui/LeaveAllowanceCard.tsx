import { theme } from '../../config/theme';

export interface AllowanceSegment {
  /** e.g. 'taken', 'booked', 'remaining' */
  label: string;
  value: number;
  color: string;
}

interface LeaveAllowanceCardProps {
  title: string;
  /** Small text on the top-right, e.g. "Week 2 of 4" or "never expires" */
  subtitle?: string;
  segments: AllowanceSegment[];
  unit?: string;
  /** Optional one-line note under the stats, e.g. auto-Sunday consumption */
  footnote?: string;
  footnoteColor?: string;
}

/**
 * A single leave-allowance card: title, a segmented progress bar (taken /
 * booked / remaining), and the matching numbers underneath — same shape for
 * every leave type (regular days off, vacation) across every role.
 */
export default function LeaveAllowanceCard({
  title, subtitle, segments, unit = 'days', footnote, footnoteColor,
}: LeaveAllowanceCardProps) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: theme.colors.white }}>{title}</h3>
        {subtitle && (
          <span className="text-[10px] font-medium" style={{ color: theme.colors.grayDark }}>{subtitle}</span>
        )}
      </div>

      <div
        className="w-full h-2.5 rounded-full overflow-hidden flex mb-3"
        style={{ backgroundColor: theme.colors.border }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-base font-bold" style={{ color: theme.colors.white }}>
              {seg.value}
              <span className="text-[10px] font-normal ml-1" style={{ color: theme.colors.grayDark }}>{unit}</span>
            </span>
            <span className="text-[10px] font-semibold" style={{ color: seg.color }}>{seg.label}</span>
          </div>
        ))}
      </div>

      {footnote && (
        <p className="text-[9px] mt-2.5 pt-2.5" style={{ color: footnoteColor ?? theme.colors.grayDark, borderTop: `1px solid ${theme.colors.border}` }}>
          {footnote}
        </p>
      )}
    </div>
  );
}
