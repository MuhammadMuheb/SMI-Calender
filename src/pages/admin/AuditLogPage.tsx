import { useState, useEffect } from 'react';
import { Card, Badge } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { fetchAuditLog } from '../../services/supabaseService';
import type { AuditAction, AuditEntity } from '../../models/audit';

interface Props { onBack: () => void }

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  user_created: 'success', user_deleted: 'danger', leave_requested: 'primary',
  leave_approved: 'success', leave_rejected: 'danger', leave_overridden: 'warning',
  balance_adjusted: 'warning', auto_assignment_run: 'primary',
  staffing_rule_created: 'primary', staffing_rule_deleted: 'danger',
  special_day_created: 'primary', special_day_deleted: 'danger',
  notification_setting_changed: 'gray',
};

export default function AuditLogPage({ onBack }: Props) {
  const [logs, setLogs] = useState<ReturnType<typeof mapLog>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [filterEntity, setFilterEntity] = useState<AuditEntity | ''>('');

  useEffect(() => {
    fetchAuditLog().then((data) => {
      setLogs(data as ReturnType<typeof mapLog>[]);
      setLoading(false);
    });
  }, []);

  const filtered = logs.filter((e) => {
    if (filterAction && e.action !== filterAction) return false;
    if (filterEntity && e.entityType !== filterEntity) return false;
    return true;
  });

  const actionOptions: AuditAction[] = [
    'user_created', 'user_updated', 'user_deleted',
    'leave_requested', 'leave_approved', 'leave_rejected', 'leave_overridden',
    'balance_adjusted', 'auto_assignment_run',
    'staffing_rule_created', 'staffing_rule_updated', 'staffing_rule_deleted',
    'special_day_created', 'special_day_deleted', 'notification_setting_changed',
  ];

  const entityOptions: AuditEntity[] = [
    'user', 'leave_request', 'balance', 'staffing_rule',
    'special_day', 'holiday', 'auto_assignment', 'notification_setting',
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Audit Log ({filtered.length})</h2>
      </div>

      <div className="flex gap-2">
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value as AuditAction | '')}
          className="flex-1 rounded-lg text-[10px] px-2 py-1.5"
          style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }}>
          <option value="">All Actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value as AuditEntity | '')}
          className="flex-1 rounded-lg text-[10px] px-2 py-1.5"
          style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }}>
          <option value="">All Entities</option>
          {entityOptions.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {(filterAction || filterEntity) && (
        <button onClick={() => { setFilterAction(''); setFilterEntity(''); }}
          className="text-[10px] cursor-pointer" style={{ color: theme.colors.primary }}>Clear filters</button>
      )}

      {loading ? (
        <Card>
          <div className="h-20 flex items-center justify-center">
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>Loading audit log...</p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="h-20 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
            <p className="text-xs" style={{ color: theme.colors.grayDark }}>
              {logs.length === 0 ? 'No actions logged yet' : 'No matching entries'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((entry) => (
            <Card key={entry.id} padding={true}>
              <div className="flex items-start justify-between mb-1">
                <Badge color={(ACTION_COLORS[entry.action as AuditAction] ?? 'gray') as 'success' | 'danger' | 'warning' | 'primary' | 'gray'} size="xs">
                  {entry.action.replace(/_/g, ' ')}
                </Badge>
                <span className="text-[9px]" style={{ color: theme.colors.grayDarker }}>
                  {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs" style={{ color: theme.colors.white }}>{entry.description}</p>
              <p className="text-[10px] mt-0.5" style={{ color: theme.colors.grayDark }}>
                by {entry.actorName} · {entry.entityType}
              </p>
              {(entry.oldValue || entry.newValue) && (
                <div className="mt-1.5 flex gap-2">
                  {entry.oldValue && (
                    <div className="flex-1 rounded px-2 py-1" style={{ backgroundColor: alpha(theme.colors.danger, '10') }}>
                      <p className="text-[9px] font-medium" style={{ color: theme.colors.danger }}>Before</p>
                      <p className="text-[9px] break-all" style={{ color: theme.colors.gray }}>{entry.oldValue}</p>
                    </div>
                  )}
                  {entry.newValue && (
                    <div className="flex-1 rounded px-2 py-1" style={{ backgroundColor: alpha(theme.colors.success, '10') }}>
                      <p className="text-[9px] font-medium" style={{ color: theme.colors.success }}>After</p>
                      <p className="text-[9px] break-all" style={{ color: theme.colors.gray }}>{entry.newValue}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Type helper for the mapped audit entry
function mapLog(_: never) { return _ as { id: string; actorId: string; actorName: string; action: string; entityType: string; entityId: string; description: string; oldValue: string | null; newValue: string | null; timestamp: string }; }
