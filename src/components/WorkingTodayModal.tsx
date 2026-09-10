import { useState, useEffect } from 'react';
import { Modal, Badge } from './ui';
import { theme } from '../config/theme';
import { useNotifications } from '../context/NotificationContext';
import type { StaffUser } from '../models/user';

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

  // Reset animation when modal closes
  useEffect(() => { if (!open) setJustSent(null); }, [open]);

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

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-1.5">
        {workingList.map((s) => {
          const isMe = s.id === currentUserId;
          const sending = justSent === s.id;
          const roles = getUserRoles?.(s.id);
          return (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ backgroundColor: theme.colors.bgCard }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: theme.colors.primary + '20', color: theme.colors.primaryLight }}>
                  {s.displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: theme.colors.white }}>
                    {s.displayName}{isMe ? <span style={{ color: theme.colors.primary }}> (You)</span> : ''}
                  </p>
                  {roles && roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {roles.map((r, ri) => (
                        <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: r.color + '20', color: r.color }}>
                          {r.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!isMe && (
                <button
                  onClick={() => handleOfferCoffee(s.id)}
                  disabled={sending}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer transition-all"
                  style={{
                    backgroundColor: sending ? theme.colors.primary + '20' : theme.colors.warning + '18',
                    color: sending ? theme.colors.primary : theme.colors.warning,
                    border: `1px solid ${sending ? theme.colors.primary + '40' : theme.colors.warning + '40'}`,
                  }}>
                  {sending ? '✓ Sent!' : '☕'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {offList.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>
            {offLabel} ({offList.length})
          </p>
          {offList.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded-lg mb-1"
              style={{ backgroundColor: theme.colors.secondary + '10' }}>
              <span className="text-xs" style={{ color: theme.colors.gray }}>{s.displayName}</span>
              <Badge color="danger" size="xs">Off</Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
