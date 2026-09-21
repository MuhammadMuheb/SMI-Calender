import { useState } from 'react';
import { Button, Modal } from './ui';
import { theme } from '../config/theme';
import type { StaffUser } from '../models/user';

interface DeleteUserConfirmationModalProps {
  open: boolean;
  user: StaffUser | null;
  onClose: () => void;
  onConfirm: (option: 'hard_delete' | 'soft_delete') => Promise<void>;
  error?: string;
}

export default function DeleteUserConfirmationModal({
  open,
  user,
  onClose,
  onConfirm,
  error,
}: DeleteUserConfirmationModalProps) {
  const [selectedOption, setSelectedOption] = useState<'hard_delete' | 'soft_delete'>('soft_delete');
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(selectedOption);
    } finally {
      setIsLoading(false);
    }
  };

  const c = theme.colors;

  return (
    <Modal open={open} onClose={onClose} title="Delete Staff Member">
      <div className="space-y-4">
        {isLoading && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-transparent rounded-full animate-spin"
                   style={{ borderTopColor: c.primary, borderRightColor: c.primary }}>
              </div>
              <p className="text-sm" style={{ color: c.white }}>Processing deletion...</p>
            </div>
          </div>
        )}

        <p className="text-sm" style={{ color: c.gray, opacity: isLoading ? 0.5 : 1 }}>
          You are about to delete <strong style={{ color: c.white }}>{user.displayName}</strong>.
          Choose what to do with their historical data:
        </p>

        {/* Hard Delete Option */}
        <button
          type="button"
          onClick={() => setSelectedOption('hard_delete')}
          disabled={isLoading}
          className="w-full p-3 rounded-lg border-2 transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selectedOption === 'hard_delete' ? c.danger : c.border,
            backgroundColor: selectedOption === 'hard_delete' ? `${c.danger}15` : c.bgCard,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ borderColor: selectedOption === 'hard_delete' ? c.danger : c.border }}
            >
              {selectedOption === 'hard_delete' && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: c.danger }}
                />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: c.white }}>
                🗑️ Permanently Delete Everything
              </p>
              <p className="text-[11px] mt-1" style={{ color: c.grayDark }}>
                Remove user account AND all historical data (requests, leaves, check-ins, assignments).
                This cannot be undone.
              </p>
            </div>
          </div>
        </button>

        {/* Soft Delete Option */}
        <button
          type="button"
          onClick={() => setSelectedOption('soft_delete')}
          disabled={isLoading}
          className="w-full p-3 rounded-lg border-2 transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selectedOption === 'soft_delete' ? c.primary : c.border,
            backgroundColor: selectedOption === 'soft_delete' ? `${c.primary}15` : c.bgCard,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ borderColor: selectedOption === 'soft_delete' ? c.primary : c.border }}
            >
              {selectedOption === 'soft_delete' && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: c.primary }}
                />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: c.white }}>
                📦 Archive Account (Retain Data)
              </p>
              <p className="text-[11px] mt-1" style={{ color: c.grayDark }}>
                Deactivate the user account but keep historical data archived. Data is hidden from
                active views but retained for records and auditing.
              </p>
            </div>
          </div>
        </button>

        {error && (
          <p className="text-xs p-2 rounded" style={{ color: c.danger, backgroundColor: `${c.danger}20` }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="outline" onClick={onClose} disabled={isLoading} fullWidth>
          Cancel
        </Button>
        <Button
          variant={selectedOption === 'hard_delete' ? 'secondary' : 'primary'}
          onClick={handleConfirm}
          disabled={isLoading}
          fullWidth
        >
          {isLoading ? 'Processing...' : selectedOption === 'hard_delete' ? 'Delete Permanently' : 'Archive Account'}
        </Button>
      </div>
    </Modal>
  );
}
