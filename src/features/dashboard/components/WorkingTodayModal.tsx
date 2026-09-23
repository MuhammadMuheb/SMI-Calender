import { TranslatedText } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { Check, Coffee, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { useNotifications } from '@/features/notifications/NotificationContext';
import type { StaffUser } from '@/models/user';

/** A job role chip. `color` is the role's stored color (data), shown as a dot. */
export function JobRoleBadge({ name, color, isPrimary }: { name: string; color?: string; isPrimary?: boolean }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
      {color && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {name}
      {isPrimary && <Star className="fill-current" aria-label="Primary role" />}
    </Badge>
  );
}

interface WorkingTodayModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  workingList: StaffUser[];
  offList: StaffUser[];
  offLabel: string;
  currentUserId: string;
  currentUserName: string;
  getUserRoles?: (userId: string) => { name: string; color: string; isPrimary: boolean }[];
}

export default function WorkingTodayModal({
  open, onClose, title, workingList, offList, offLabel,
  currentUserId, currentUserName, getUserRoles,
}: WorkingTodayModalProps) {
  const { addNotification } = useNotifications();
  const [justSent, setJustSent] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setJustSent(null);
      onClose();
    }
  };

  const handleOfferCoffee = (targetId: string) => {
    addNotification(
      targetId,
      'coffee_offer',
      `☕ Coffee from ${currentUserName}`,
      `${currentUserName} is offering you a coffee! Accept or let them know.`,
      'coffee',
      currentUserId,
      currentUserId,
    );
    setJustSent(targetId);
    setTimeout(() => setJustSent(null), 1200);
  };

  const working = (workingList ?? []).filter((s) => s && s.id);

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} title={title}>
      {working.length === 0 ? (
        <EmptyState icon={Users} title="No one on the schedule" description="Everyone on the team has the day off." />
      ) : (
        <ItemGroup className="gap-1">
          {working.map((s) => {
            const displayName = s.displayName ?? s.username ?? 'Unknown';
            const isMe = s.id === currentUserId;
            const sending = justSent === s.id;
            const roles = getUserRoles?.(s.id);
            return (
              <Item key={s.id} size="sm" className="px-2">
                <ItemMedia>
                  <UserAvatar name={displayName} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    {displayName}
                    {isMe && <Badge variant="secondary">You</Badge>}
                  </ItemTitle>
                  {roles && roles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r, ri) => <JobRoleBadge key={ri} name={r.name} color={r.color} />)}
                    </div>
                  )}
                </ItemContent>
                {!isMe && (
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOfferCoffee(s.id)}
                      disabled={sending}
                      aria-label={sending ? `Coffee offered to ${displayName}` : `Offer ${displayName} a coffee`}
                    >
                      {sending ? <Check /> : <Coffee />}
                      {sending ? 'Sent' : 'Coffee'}
                    </Button>
                  </ItemActions>
                )}
              </Item>
            );
          })}
        </ItemGroup>
      )}

      {offList.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {offLabel} ({offList.length})
          </p>
          <ul className="flex flex-col gap-1">
            {offList.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="truncate text-muted-foreground">{s.displayName}</span>
                <Badge variant="secondary"><TranslatedText text="Off" /></Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ResponsiveDialog>
  );
}
