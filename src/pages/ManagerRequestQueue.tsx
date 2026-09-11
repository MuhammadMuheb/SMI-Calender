import { useState } from 'react';
import { Card, Badge } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import type { LeaveRequest, LeaveStatus } from '../models/leave';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from '../models/leave';
import RequestDetailModal from './RequestDetailModal';

/**
 * STATUS: UI COMPLETE, USES IN-MEMORY STORE (MOCK)
 * Manager sees all staff requests across all users.
 * Tap a request to open detail modal with staffing impact + approve/reject.
 */

const TABS: { status: LeaveStatus | 'all'; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'all', label: 'All' },
];

interface ManagerRequestQueueProps {
  onBack: () => void;
}

export default function ManagerRequestQueue({ onBack }: ManagerRequestQueueProps) {
  const { requests } = useLeave();
  const [activeTab, setActiveTab] = useState<LeaveStatus | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  // Managers see only staff requests (not their own, not other managers')
  // Super admin sees everything
  const allRequests = requests
    .filter((r) => r.leaveType !== 'auto_sunday')
    .filter((r) => {
      if (isAdmin) return true; // Admin sees all
      // Manager: only see staff requests, never own requests
      return r.userRef.role === 'staff' && r.userId !== user?.id;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const filtered =
    activeTab === 'all'
      ? allRequests
      : allRequests.filter((r) => r.status === activeTab);

  const pendingCount = allRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-xs font-medium cursor-pointer"
          style={{ color: theme.colors.primary }}
        >
          ← Back
        </button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>
          Request Queue
        </h2>
        {pendingCount > 0 && (
          <Badge color="warning" size="xs">{pendingCount}</Badge>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const count =
            tab.status === 'all'
              ? allRequests.length
              : allRequests.filter((r) => r.status === tab.status).length;
          const isActive = activeTab === tab.status;
          return (
            <button
              key={tab.status}
              onClick={() => setActiveTab(tab.status)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: isActive ? theme.colors.primary : theme.colors.bgElevated,
                color: isActive ? theme.colors.white : theme.colors.grayDark,
                border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <Card>
          <div
            className="h-20 flex items-center justify-center rounded-lg"
            style={{ border: `1px dashed ${theme.colors.border}` }}
          >
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>
              No {activeTab === 'all' ? '' : activeTab} requests
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className="w-full text-left cursor-pointer"
            >
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}
                    >
                      {req.userRef.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: theme.colors.white }}>
                        {req.userRef.displayName}
                      </p>
                      <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                        {new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        {LEAVE_TYPE_LABELS[req.leaveType]}
                      </p>
                    </div>
                  </div>
                  <Badge
                    color={LEAVE_STATUS_COLORS[req.status] as 'warning' | 'success' | 'danger' | 'gray'}
                    size="xs"
                  >
                    {LEAVE_STATUS_LABELS[req.status]}
                  </Badge>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <RequestDetailModal
        request={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}
