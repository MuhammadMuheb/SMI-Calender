import { theme } from '../../config/theme';

interface BalanceRingProps {
  label: string;
  sublabel: string;
  remaining: number;
  total: number;
  color: string;
  size?: number;
}

/**
 * A circular progress ring showing remaining/total for one leave balance.
 * The arc fills proportionally to how much is remaining (never resets to
 * zero visually just because nothing's been used yet — full ring = full bank).
 */
export default function BalanceRing({ label, sublabel, remaining, total, color, size = 76 }: BalanceRingProps) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const dash = circumference * pct;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${remaining} of ${total} ${sublabel} remaining`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.colors.border} strokeWidth="6" />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="16" fontWeight="700" fill={theme.colors.white}>{remaining}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill={theme.colors.grayDark}>of {total}</text>
      </svg>
      <span className="text-[10px] font-semibold text-center" style={{ color }}>{label}</span>
    </div>
  );
}
