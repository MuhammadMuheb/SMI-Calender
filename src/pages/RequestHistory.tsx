import { useState } from 'react';
import { Card, Badge, Button, Icons, BalanceRing } from '../components/ui';
import { theme } from '../config/theme';
import { alpha } from '../utils/themeColor';
import { useAuth } from '../context/AuthContext';
import { useLeave } from '../context/LeaveContext';
import { safeSort } from '../utils/safeData';
import MoveDayOffModal from '../components/MoveDayOffModal';
import RequestFormModal from './RequestFormModal';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_COLORS,
  type LeaveStatus,
  type LeaveRequest,
} from '../models/leave';

const STATUS_TABS: { status: LeaveStatus | 'all'; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'all', label: 'All' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

interface RequestHistoryProps { onBack: () => void; }

export default function RequestHistory({ onBack }: RequestHistoryProps) {
  const { user } = useAuth();
  const { getUserRequests, cancelRequest, getBalance } = useLeave();
  const [view, setView] = useState<'requests' | 'balance'>('requests');
  const [activeTab, setActiveTab] = useState<LeaveStatus | 'all'>('pending');
  const [moveRequest, setMoveRequest] = useState<LeaveRequest | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  if (!user) return null;

  const allRequests = safeSort(
    getUserRequests(user.id)
      .filter((r) => r.leaveType !== 'auto_sunday'),
    'createdAt',
    true
  );

  const filtered = activeTab === 'all' ? allRequests : allRequests.filter((r) => r.status === activeTab);
  const balance = getBalance(user.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Balance</h2>
      </div>

      {/* Requests / Balance top-level toggle */}
      <div className="flex rounded-xl p-1" style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
        {(['requests', 'balance'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
            style={{
              backgroundColor: view === v ? theme.colors.primary : 'transparent',
              color: view === v ? theme.colors.white : theme.colors.grayDark,
            }}
          >
            {v === 'requests' ? 'Requests' : 'Balance'}
          </button>
        ))}
      </div>

      {view === 'balance' ? (
        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-around py-2">
              <BalanceRing label="Regular Days" sublabel="days" remaining={balance.regularDaysRemaining} total={balance.regularDaysAllowed} color={theme.colors.primary} />
              <BalanceRing label="Vacation" sublabel="days" remaining={balance.vacationDaysRemaining} total={balance.vacationDaysTotal} color={theme.colors.white} />
            </div>
            <p className="text-[9px] text-center mt-1" style={{ color: theme.colors.grayDark }}>
              Regular days reset each cycle · vacation accrues and rolls over
            </p>
          </Card>
          <Button variant="primary" fullWidth icon={Icons.plus} onClick={() => setShowRequestForm(true)}>
            Request Day Off
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => {
              const count = tab.status === 'all' ? allRequests.length : allRequests.filter((r) => r.status === tab.status).length;
              const isActive = activeTab === tab.status;
              return (
                <button key={tab.status} onClick={() => setActiveTab(tab.status)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
                  style={{ backgroundColor: isActive ? theme.colors.primary : theme.colors.bgElevated,
                    color: isActive ? theme.colors.white : theme.colors.grayDark,
                    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}` }}>
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-8">
                <EmptyStateIcon />
                <p className="text-xs mt-3" style={{ color: theme.colors.grayDark }}>
                  No {activeTab === 'all' ? '' : activeTab} requests
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((req) => (
                <Card key={req.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: theme.colors.white }}>
                        {new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>{LEAVE_TYPE_LABELS[req.leaveType]}</p>
                      {req.staffNote && <p className="text-[10px] mt-1 italic" style={{ color: theme.colors.gray }}>"{req.staffNote}"</p>}
                      {req.approverNote && <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>Manager: {req.approverNote}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge color={LEAVE_STATUS_COLORS[req.status] as 'warning' | 'success' | 'danger' | 'gray'} size="xs">
                        {LEAVE_STATUS_LABELS[req.status]}
                      </Badge>
                      {req.isOverridden && <Badge color="secondary" size="xs">Overridden</Badge>}
                      {req.status === 'pending' && (
                        <button onClick={() => cancelRequest(req.id)} className="text-[10px] mt-1 cursor-pointer" style={{ color: theme.colors.secondary }}>Cancel</button>
                      )}
                      {req.status === 'approved' && !req.staffNote?.includes('Fixed schedule') && (
                        <button onClick={() => setMoveRequest(req)} className="text-[10px] mt-1 cursor-pointer" style={{ color: theme.colors.primaryLight }}>Move</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Button variant="outline" fullWidth icon={Icons.plus} onClick={() => setShowRequestForm(true)}>
            Request Day Off
          </Button>
        </>
      )}

      <MoveDayOffModal request={moveRequest} open={!!moveRequest} onClose={() => setMoveRequest(null)} />
      <RequestFormModal open={showRequestForm} onClose={() => setShowRequestForm(false)} />
    </div>
  );
}

/** Simple monochrome line-art empty-state mark — no new colors, just primary + gray. */
function EmptyStateIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="No requests">
      <circle cx="36" cy="36" r="30" fill="none" stroke={theme.colors.border} strokeWidth="2" strokeDasharray="4 5" />
      <circle cx="36" cy="36" r="20" fill={alpha(theme.colors.primary, '15')} stroke={theme.colors.primary} strokeWidth="2" />
      <path d="M27 36l7 7 13-14" fill="none" stroke={theme.colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
