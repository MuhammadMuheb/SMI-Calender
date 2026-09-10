import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLES, ROLE_LABELS, ROLE_BADGE_COLOR, type Role } from '../../config/roles';

interface Props { onBack: () => void }

export default function UserManagement({ onBack }: Props) {
  const { user } = useAuth();
  const {
    users, addUser, updateUser,
    jobRoles, roleAssignments, assignRole, removeRoleAssignment,
  } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingRolesFor, setEditingRolesFor] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<Role>(ROLES.STAFF);
  const [formJobRoles, setFormJobRoles] = useState<Set<string>>(new Set());
  const [formPrimaryRole, setFormPrimaryRole] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [formDaysOff, setFormDaysOff] = useState(6);
  const [formAutoAssign, setFormAutoAssign] = useState(true);

  const resetForm = () => {
    setFormName(''); setFormUsername(''); setFormPin('');
    setFormRole(ROLES.STAFF); setFormJobRoles(new Set());
    setFormPrimaryRole(''); setFormError('');
    setFormDaysOff(6); setFormAutoAssign(true);
  };

  const toggleJobRole = (roleId: string) => {
    setFormJobRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) { next.delete(roleId); if (formPrimaryRole === roleId) setFormPrimaryRole(''); }
      else { next.add(roleId); if (next.size === 1) setFormPrimaryRole(roleId); }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formUsername.trim()) { setFormError('Name and username required'); return; }
    if (formPin.length < 4) { setFormError('PIN must be 4+ digits'); return; }
    if (users.some((u) => u.username.toLowerCase() === formUsername.trim().toLowerCase())) {
      setFormError('Username already exists'); return;
    }
    if (formRole !== ROLES.SPECTATOR && formJobRoles.size === 0) { setFormError('Select at least one job role'); return; }

    await addUser({
      username: formUsername.trim().toLowerCase(),
      displayName: formName.trim(),
      pin: formPin,
      role: formRole,
      isActive: true,
    }, user?.displayName ?? 'Admin');

    setTimeout(async () => {
      const { data: latestUsers } = await supabase.from('users').select('id, username').eq('username', formUsername.trim().toLowerCase());
      const created = latestUsers?.[0];
      if (created) {
        for (const roleId of formJobRoles) {
          assignRole(created.id, roleId, roleId === formPrimaryRole);
        }
      }
    }, 500);

    resetForm();
    setShowAdd(false);
  };

  // Safe remove: deactivate + strip all job-role assignments.
  // Keeps history, avoids foreign-key errors from a hard delete.
  const handleDelete = async (id: string) => {
    await updateUser(id, { isActive: false }, user?.displayName ?? 'Admin');
    roleAssignments
      .filter((a) => a.userId === id)
      .forEach((a) => removeRoleAssignment(a.id));
    setConfirmDelete(null);
  };

  const getUserJobRoles = (userId: string) => {
    return roleAssignments
      .filter((a) => a.userId === userId)
      .map((a) => ({
        ...a,
        roleName: jobRoles.find((r) => r.id === a.jobRoleId)?.name ?? a.jobRoleId,
        roleColor: jobRoles.find((r) => r.id === a.jobRoleId)?.color ?? '#666',
      }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>&larr; Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Users ({users.length})</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowAdd(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => {
          const userRoles = getUserJobRoles(u.id);
          return (
            <Card key={u.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: theme.colors.primary + '20', color: theme.colors.primaryLight }}>
                    {u.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{u.displayName}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>{u.username}</span>
                      <Badge color={ROLE_BADGE_COLOR[u.role]} size="xs">{ROLE_LABELS[u.role]}</Badge>
                      {!u.isActive && <Badge color="danger" size="xs">Inactive</Badge>}
                    </div>
                    {userRoles.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {userRoles.map((r) => (
                          <span key={r.id} className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: r.roleColor + '20', color: r.roleColor }}>
                            {r.roleName}{r.isPrimary ? ' \u2605' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditingRolesFor(editingRolesFor === u.id ? null : u.id)}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgCard }}>Roles</button>
                  <button onClick={() => updateUser(u.id, { isActive: !u.isActive }, user?.displayName ?? 'Admin')}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: u.isActive ? theme.colors.warning : theme.colors.success, backgroundColor: theme.colors.bgCard }}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => setConfirmDelete(u.id)}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer"
                    style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>Remove</button>
                </div>
              </div>

              {editingRolesFor === u.id && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.colors.grayDark }}>
                    Assign Job Roles
                  </p>
                  <div className="space-y-1">
                    {jobRoles.map((jr) => {
                      const assigned = roleAssignments.find((a) => a.userId === u.id && a.jobRoleId === jr.id);
                      return (
                        <div key={jr.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ backgroundColor: assigned ? jr.color + '10' : theme.colors.bgCard,
                            border: `1px solid ${assigned ? jr.color + '40' : theme.colors.border}` }}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jr.color }} />
                            <span className="text-xs" style={{ color: theme.colors.white }}>
                              {jr.name} {jr.isHidden && <span style={{ color: theme.colors.grayDark }}>(hidden)</span>}
                            </span>
                          </div>
                          {assigned ? (
                            <button onClick={() => removeRoleAssignment(assigned.id)}
                              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>Remove</button>
                          ) : (
                            <button onClick={() => assignRole(u.id, jr.id, false)}
                              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                              style={{ color: theme.colors.primary, backgroundColor: theme.colors.bgCard }}>Assign</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add User"
        footer={<><Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleAdd}>Create User</Button></>}>
        <FormInput label="Display Name" placeholder="Full name" value={formName} onChange={(e) => setFormName(e.target.value)} />
        <FormInput label="Username" placeholder="login username" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} />
        <FormInput label="PIN" type="password" placeholder="4+ digits" value={formPin}
          onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Access Level</label>
          <div className="flex gap-2 flex-wrap">
            {([ROLES.STAFF, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SPECTATOR] as Role[]).map((r) => (
              <button key={r} onClick={() => setFormRole(r)}
                className="flex-1 py-2 rounded-lg text-[10px] font-medium cursor-pointer"
                style={{
                  backgroundColor: formRole === r ? theme.colors.primary : theme.colors.bgCard,
                  color: formRole === r ? theme.colors.white : theme.colors.grayDark,
                  border: `1px solid ${formRole === r ? theme.colors.primary : theme.colors.border}`,
                }}>{ROLE_LABELS[r]}</button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>
            Job Roles <span style={{ color: theme.colors.grayDark }}>(what positions they work)</span>
          </label>
          <div className="space-y-1">
            {jobRoles.map((jr) => {
              const selected = formJobRoles.has(jr.id);
              return (
                <button key={jr.id} onClick={() => toggleJobRole(jr.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer"
                  style={{
                    backgroundColor: selected ? jr.color + '15' : theme.colors.bgCard,
                    border: `1px solid ${selected ? jr.color : theme.colors.border}`,
                  }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jr.color }} />
                    <span className="text-xs" style={{ color: theme.colors.white }}>{jr.name}</span>
                    {jr.isHidden && <span className="text-[9px]" style={{ color: theme.colors.grayDark }}>(hidden)</span>}
                  </div>
                  {selected && (
                    <button onClick={(e) => { e.stopPropagation(); setFormPrimaryRole(jr.id); }}
                      className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                      style={{
                        backgroundColor: formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.bgCard,
                        color: formPrimaryRole === jr.id ? theme.colors.white : theme.colors.grayDark,
                        border: `1px solid ${formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.border}`,
                      }}>
                      {formPrimaryRole === jr.id ? '\u2605 Primary' : 'Set Primary'}
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Day-Off Quota (this cycle)</label>
          <div className="flex items-center gap-3">
            <input type="number" min={0} max={10} value={formDaysOff} onChange={(e) => setFormDaysOff(Number(e.target.value))}
              className="w-20 rounded-lg text-sm outline-none px-3 py-2 text-center"
              style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white }} />
            <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>days off per cycle</span>
          </div>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input type="checkbox" checked={formAutoAssign} onChange={(e) => setFormAutoAssign(e.target.checked)} />
            <span className="text-[10px]" style={{ color: theme.colors.gray }}>Auto-assign days off for current cycle</span>
          </label>
        </div>
        {formError && <p className="text-xs" style={{ color: theme.colors.danger }}>{formError}</p>}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove User"
        footer={<><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Remove</Button></>}>
        <p className="text-sm" style={{ color: theme.colors.gray }}>
          This deactivates the person and removes them from all schedules and the check-in board. Their past attendance history is kept. You can reactivate them later.
        </p>
      </Modal>
    </div>
  );
}
