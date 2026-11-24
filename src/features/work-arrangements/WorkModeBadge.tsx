import { Building2, House, Globe2, CalendarDays, Coffee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { WorkMode } from '../../../shared/work-arrangements.mjs';
// eslint-disable-next-line react-refresh/only-export-components
export const MODE_LABELS = { on_site: 'On-site', wfh: 'WFH', remote: 'Remote', hybrid: 'Hybrid', off: 'Time off' };
const icons = { on_site: Building2, wfh: House, remote: Globe2, hybrid: CalendarDays, off: Coffee };
const colors = { on_site: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200', wfh: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', remote: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200', hybrid: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', off: '' };
export function WorkModeBadge({ mode, compact = false }: { mode: WorkMode | 'off'; compact?: boolean }) {
  const Icon = icons[mode];
  return <Badge variant="secondary" className={colors[mode]} title={MODE_LABELS[mode]}><Icon aria-hidden="true" />{!compact && MODE_LABELS[mode]}{compact && <span className="sr-only">{MODE_LABELS[mode]}</span>}</Badge>;
}
