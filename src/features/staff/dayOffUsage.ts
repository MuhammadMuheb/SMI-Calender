/** Keep the allowance indicator bounded without changing approved leave history. */
export function getDayOffUsage(approvedDays: number, allowance: number) {
  const allowed = Number.isFinite(allowance) ? Math.max(0, allowance) : 0;
  const approved = Number.isFinite(approvedDays) ? Math.max(0, approvedDays) : 0;
  const used = Math.min(approved, allowed);
  return {
    used,
    allowed,
    percentage: allowed > 0 ? (used / allowed) * 100 : 0,
    description: approved > allowed
      ? `${approved} approved days in the leave history; ${approved - allowed} above the ${allowed}-day allowance.`
      : `${used} of ${allowed} days off used`,
  };
}
