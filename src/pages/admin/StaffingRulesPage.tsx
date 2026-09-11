import { useState } from 'react';
import { Card, Badge, Button, Modal, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import type { StaffingEnforcement } from '../../models/staffing';

const DAY_NAMES = ['All Days', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props { onBack: () => void }

export default function StaffingRulesPage({ onBack }: Props) {
  const { user } = useAuth();
  const { staffingRules, jobRoles, roleAssignments, addStaffingRule, updateStaffingRule, deleteStaffingRule } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [formRoleId, setFormRoleId] = useState('');
  const [formDay, setFormDay] = useState<number | null>(null);
  const [formMin, setFormMin] = useState(1);
  const [formEnf, setFormEnf] = useState<StaffingEnforcement>('warning_only');

  const handleAdd = () => {
    if (!formRoleId) return;
    addStaffingRule({
      jobRoleId: formRoleId, dayOfWeek: formDay, minimumRequired: formMin, enforcement: formEnf,
    }, user?.displayName ?? 'Admin');
    setShowAdd(false); setFormRoleId(''); setFormDay(null); setFormMin(1);
  };

  const roleName = (id: string) => jobRoles.find((r) => r.id === id)?.name ?? id;
  const headcountFor = (jobRoleId: string) => roleAssignments.filter((a) => a.jobRoleId === jobRoleId).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Staffing Rules</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowAdd(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {staffingRules.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: theme.colors.white }}>
                  {roleName(rule.jobRoleId)} — min {rule.minimumRequired}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                    {rule.dayOfWeek === null ? 'All days' : DAY_NAMES[(rule.dayOfWeek + 1) % 8] ?? `Day ${rule.dayOfWeek}`}
                  </span>
                  <Badge color={rule.enforcement === 'hard_block' ? 'danger' : 'warning'} size="xs">
                    {rule.enforcement === 'hard_block' ? 'Hard Block' : 'Warning'}
                  </Badge>
                </div>
                <p className="text-[9px] mt-1" style={{ color: theme.colors.grayDark }}>
                  {headcountFor(rule.jobRoleId)} people in this role → max{' '}
                  <span style={{ color: theme.colors.primary, fontWeight: 600 }}>
                    {Math.max(0, headcountFor(rule.jobRoleId) - rule.minimumRequired)}
                  </span>{' '}
                  can be off at once
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => updateStaffingRule(rule.id, {
                    enforcement: rule.enforcement === 'hard_block' ? 'warning_only' : 'hard_block',
                  }, user?.displayName ?? 'Admin')}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                  style={{ color: theme.colors.warning, backgroundColor: theme.colors.bgCard }}>
                  Toggle
                </button>
                <button
                  onClick={() => deleteStaffingRule(rule.id, user?.displayName ?? 'Admin')}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                  style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Staffing Rule"
        footer={<><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd} disabled={!formRoleId}>Create</Button></>}>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Job Role</label>
          <div className="space-y-1">
            {jobRoles.map((r) => (
              <button key={r.id} onClick={() => setFormRoleId(r.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer"
                style={{
                  backgroundColor: formRoleId === r.id ? alpha(theme.colors.primary, '15') : theme.colors.bgCard,
                  color: theme.colors.white,
                  border: `1px solid ${formRoleId === r.id ? theme.colors.primary : theme.colors.border}`,
                }}>
                {r.name} {r.isHidden && '(Hidden)'}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Day</label>
          <select value={formDay === null ? 'all' : formDay}
            onChange={(e) => setFormDay(e.target.value === 'all' ? null : Number(e.target.value))}
            className="w-full rounded-lg text-sm px-3 py-2.5"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }}>
            <option value="all">All Days</option>
            {[0,1,2,3,4,5,6].map((d) => <option key={d} value={d}>{DAY_NAMES[d+1]}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Minimum Staff</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setFormMin(Math.max(1, formMin - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: theme.colors.bgCard, color: theme.colors.white, border: `1px solid ${theme.colors.border}` }}>−</button>
            <span className="text-lg font-bold" style={{ color: theme.colors.white }}>{formMin}</span>
            <button onClick={() => setFormMin(formMin + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: theme.colors.bgCard, color: theme.colors.white, border: `1px solid ${theme.colors.border}` }}>+</button>
          </div>
          {formRoleId && (
            <p className="text-[10px] mt-2" style={{ color: theme.colors.grayDark }}>
              {headcountFor(formRoleId)} people currently have this role → max{' '}
              <span style={{ color: theme.colors.primary, fontWeight: 600 }}>
                {Math.max(0, headcountFor(formRoleId) - formMin)}
              </span>{' '}
              can take leave the same day
              {formMin > headcountFor(formRoleId) && (
                <span style={{ color: theme.colors.danger }}> — minimum exceeds total headcount, nobody could ever take this day off</span>
              )}
            </p>
          )}
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Enforcement</label>
          <div className="flex gap-2">
            {(['warning_only', 'hard_block'] as StaffingEnforcement[]).map((e) => (
              <button key={e} onClick={() => setFormEnf(e)}
                className="flex-1 py-2 rounded-lg text-[10px] font-medium cursor-pointer"
                style={{
                  backgroundColor: formEnf === e ? (e === 'hard_block' ? theme.colors.danger : theme.colors.warning) + '20' : theme.colors.bgCard,
                  color: formEnf === e ? (e === 'hard_block' ? theme.colors.danger : theme.colors.warning) : theme.colors.grayDark,
                  border: `1px solid ${formEnf === e ? (e === 'hard_block' ? theme.colors.danger : theme.colors.warning) : theme.colors.border}`,
                }}>
                {e === 'hard_block' ? 'Hard Block' : 'Warning Only'}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
