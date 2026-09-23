import { AlertCircle, CalendarRange } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import BalanceRing from '@/features/leave/components/BalanceRing';
import { formatShortDate } from '@/features/leave/leaveMeta';
import { cn } from '@/lib/utils';
import type { LeaveBalance } from '@/models/balance';
import type { StaffUser } from '@/models/user';

interface StaffLeaveDetailModalProps {
  open: boolean;
  onClose: () => void;
  staff: StaffUser | null;
  balance: LeaveBalance | null;
}

export default function StaffLeaveDetailModal({
  open,
  onClose,
  staff,
  balance,
}: StaffLeaveDetailModalProps) {
  const onOpenChange = (o: boolean) => { if (!o) onClose(); };

  if (open && (!staff || !balance)) {
    return (
      <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Leave balance" size="sm">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Couldn’t load this balance</AlertTitle>
          <AlertDescription>Close this and open the staff member again. If it keeps happening, refresh the page.</AlertDescription>
        </Alert>
      </ResponsiveDialog>
    );
  }

  if (!staff || !balance) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Leave balance" size="md">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <UserAvatar name={staff.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{staff.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{staff.username}</p>
          </div>
          <Badge
            variant="secondary"
            className={cn('border-transparent', staff.isActive ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}
          >
            {staff.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="text-muted-foreground">Current cycle: </span>
            {formatShortDate(balance.cycleStart)} – {formatShortDate(balance.cycleEnd)}
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <BalanceRing
            label="Regular days off this cycle"
            sublabel="days"
            remaining={balance.regularDaysRemaining}
            total={balance.regularDaysAllowed}
            tone="day-off"
            hint={`${balance.regularDaysUsed} used · resets each cycle`}
          />
          <BalanceRing
            label="Paid vacation"
            sublabel="days"
            remaining={balance.vacationDaysRemaining}
            total={balance.vacationDaysTotal}
            tone="vacation"
            hint={`${balance.vacationDaysUsed} used · never expires`}
          />
        </div>

        <Separator />

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Vacation accrues 2 days a month and rolls over.</p>
          <p>Regular days off reset each cycle; approved requests are deducted automatically.</p>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
