import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Modal, FormInput, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES, ROLE_LABELS, ROLE_BADGE_COLOR, type Role } from '../../config/roles';
import { getDisplayName, getUserInitial } from '../../utils/safeFallbacks';
import type { StaffUser } from '../../models/user';

const ROLE_OPTIONS: Role[] = [ROLES.STAFF, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SPECTATOR];

function ActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Staff actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
        style={{ color: theme.colors.grayDark, backgroundColor: open ? theme.colors.bgCard : 'transparent' }}
      >
        {Icons.moreVertical}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-10 w-36 rounded-lg overflow-hidden shadow-lg"
          style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer"
            style={{ color: theme.colors.white }}
          >
            {Icons.edit} Edit
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left cursor-pointer"
            style={{ color: theme.colors.danger }}
          >
            {Icons.trash} Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface Props { onBack: () => void }

export default function StaffManagement({ onBack }: Props) {
  const { user } = useAuth();
  const {
    users, addUser, updateUser, deleteUser,
    jobRoles, roleAssignments, assignRole, removeRoleAssignment,
  } = useAppData();

  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffUser | null>(null);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<Role>(ROLES.STAFF);
  const [formJobRoles, setFormJobRoles] = useState<Set<string>>(new Set());
  const [formPrimaryRole, setFormPrimaryRole] = useState<string>('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const actorName = user?.displayName ?? 'Admin';

  const resetForm = () => {
    setFormName(''); setFormUsername(''); setFormPin('');
    setFormRole(ROLES.STAFF); setFormJobRoles(new Set());
    setFormPrimaryRole(''); setFormActive(true); setFormError('');
  };

  const toggleJobRole = (roleId: string) => {
    setFormJobRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) { next.delete(roleId); if (formPrimaryRole === roleId) setFormPrimaryRole(''); }
      else { next.add(roleId); if (next.size === 1) setFormPrimaryRole(roleId); }
      return next;
    });
  };

  const openEdit = (staff: StaffUser) => {
    setEditingStaff(staff);
    setFormName(staff.displayName);
    setFormUsername(staff.username);
    setFormPin('');
    setFormRole(staff.role);
    setFormActive(staff.isActive);
    const assigned = roleAssignments.filter((a) => a.userId === staff.id);
    setFormJobRoles(new Set(assigned.map((a) => a.jobRoleId)));
    setFormPrimaryRole(assigned.find((a) => a.isPrimary)?.jobRoleId ?? '');
    setFormError('');
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formUsername.trim()) { setFormError('Name and username are required'); return; }
    if (formPin.length < 4) { setFormError('PIN must be 4+ digits'); return; }
    if (users.some((u) => u.username.toLowerCase() === formUsername.trim().toLowerCase())) {
      setFormError('That username is already taken'); return;
    }

    const newId = await addUser({
      username: formUsername.trim().toLowerCase(),
      displayName: formName.trim(),
      pin: formPin,
      role: formRole,
      isActive: true,
    }, actorName);

    for (const roleId of formJobRoles) assignRole(newId, roleId, roleId === formPrimaryRole, actorName);

    resetForm();
    setShowAdd(false);
  };

  const handleEditSave = async () => {
    if (!editingStaff) return;
    if (!formName.trim()) { setFormError('Name is required'); return; }
    if (formPin && formPin.length < 4) { setFormError('PIN must be 4+ digits'); return; }

    const updates: Partial<StaffUser> = {
      displayName: formName.trim(),
      role: formRole,
      isActive: formActive,
    };
    if (formPin) updates.pin = formPin;
    await updateUser(editingStaff.id, updates, actorName);

    const currentAssignments = roleAssignments.filter((a) => a.userId === editingStaff.id);
    for (const a of currentAssignments) {
      if (!formJobRoles.has(a.jobRoleId)) removeRoleAssignment(a.id, actorName);
    }
    for (const roleId of formJobRoles) {
      const existing = currentAssignments.find((a) => a.jobRoleId === roleId);
      if (!existing) assignRole(editingStaff.id, roleId, roleId === formPrimaryRole, actorName);
    }

    resetForm();
    setEditingStaff(null);
  };

  const handleDelete = async (staff: StaffUser) => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`DELETE WORKFLOW INITIATED`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`Target: ${staff.displayName} (username: ${staff.username}, ID: ${staff.id})`);
    setDeleteError('');

    try {
      // Step 1: Clean up role assignments
      const userAssignments = roleAssignments.filter((a) => a.userId === staff.id);
      console.log(`\n[UI] Step 1: Cleaning up role assignments (found ${userAssignments.length})`);

      if (userAssignments.length > 0) {
        const removePromises = userAssignments.map((a) => removeRoleAssignment(a.id, actorName));
        await Promise.all(removePromises);
        console.log(`[UI] ✓ All ${userAssignments.length} role assignments removed`);
      } else {
        console.log(`[UI] ✓ No role assignments to remove`);
      }

      // Step 2: Delete user from Firestore
      console.log(`[UI] Step 2: Initiating Firestore deletion...`);
      await deleteUser(staff.id, actorName);
      console.log(`[UI] ✓ User deleted from Firestore`);

      // Step 3: Close modal and complete
      console.log(`[UI] Step 3: Closing confirmation dialog`);
      setConfirmDelete(null);
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`✓✓✓ DELETION WORKFLOW COMPLETE ✓✓✓`);
      console.log(`Staff member "${staff.displayName}" has been permanently removed.`);
      console.log(`${'═'.repeat(50)}\n`);

    } catch (err) {
      console.error(`\n${'═'.repeat(50)}`);
      console.error(`✗ DELETION WORKFLOW FAILED`);
      console.error(`${'═'.repeat(50)}`);
      console.error(`Staff: ${staff.displayName} (${staff.username})`);
      console.error(`Error: ${(err as any)?.message || String(err)}`);
      console.error(`Code: ${(err as any)?.code || 'N/A'}`);

      if ((err as any)?.stack) {
        console.error(`Stack:\n${(err as any).stack}`);
      }

      // User-friendly error message
      let userMessage = `Failed to delete ${staff.displayName}`;
      if ((err as any)?.message) {
        const msg = (err as any).message;
        if (msg.includes('PERMISSION_DENIED') || msg.includes('security')) {
          userMessage += ': Security rules are blocking deletion. Contact your admin.';
        } else if (msg.includes('not found')) {
          userMessage += ': User record not found in database.';
        } else {
          userMessage += `: ${msg}`;
        }
      }

      setDeleteError(`❌ ${userMessage}`);
      console.error(`${'═'.repeat(50)}\n`);
    }
  };

  const getJobRoleNames = (userId: string) =>
    roleAssignments
      .filter((a) => a.userId === userId)
      .map((a) => ({ ...a, roleName: jobRoles.find((r) => r.id === a.jobRoleId)?.name ?? a.jobRoleId, roleColor: jobRoles.find((r) => r.id === a.jobRoleId)?.color ?? '#666' }));

  const roleForm = (
    <>
      <FormInput label="Display Name" placeholder="Full name" value={formName} onChange={(e) => setFormName(e.target.value)} />
      {editingStaff ? (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Username</label>
          <p className="text-xs px-3 py-2.5 rounded-lg" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.grayDark }}>
            {formUsername} <span className="text-[10px]">(cannot be changed)</span>
          </p>
        </div>
      ) : (
        <FormInput label="Username" placeholder="login username" value={formUsername}
          onChange={(e) => setFormUsername(e.target.value)} />
      )}
      <FormInput label={editingStaff ? 'Reset PIN (optional)' : 'PIN'} type="password"
        placeholder={editingStaff ? 'Leave blank to keep current PIN' : '4+ digits'} value={formPin}
        onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Role (Permission Level)</label>
        <div className="flex gap-2 flex-wrap">
          {ROLE_OPTIONS.map((r) => (
            <button key={r} type="button" onClick={() => setFormRole(r)}
              className="flex-1 py-2 rounded-lg text-[10px] font-medium cursor-pointer"
              style={{
                backgroundColor: formRole === r ? theme.colors.primary : theme.colors.bgCard,
                color: formRole === r ? theme.colors.white : theme.colors.grayDark,
                border: `1px solid ${formRole === r ? theme.colors.primary : theme.colors.border}`,
              }}>{ROLE_LABELS[r]}</button>
          ))}
        </div>
      </div>

      {editingStaff && (
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => setFormActive(!formActive)}
            className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: formActive ? theme.colors.success : theme.colors.bgCard, border: `1px solid ${formActive ? theme.colors.success : theme.colors.border}` }}>
            {formActive && <span className="text-[10px] font-bold" style={{ color: theme.colors.bg }}>✓</span>}
          </button>
          <span className="text-xs" style={{ color: theme.colors.gray }}>Active (can sign in)</span>
        </div>
      )}

      {jobRoles.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>
            Job Roles <span style={{ color: theme.colors.grayDark }}>(optional — what positions they work)</span>
          </label>
          <div className="space-y-1">
            {jobRoles.map((jr) => {
              const selected = formJobRoles.has(jr.id);
              return (
                <button key={jr.id} type="button" onClick={() => toggleJobRole(jr.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer"
                  style={{ backgroundColor: selected ? jr.color + '15' : theme.colors.bgCard, border: `1px solid ${selected ? jr.color : theme.colors.border}` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jr.color }} />
                    <span className="text-xs" style={{ color: theme.colors.white }}>{jr.name}</span>
                  </div>
                  {selected && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFormPrimaryRole(jr.id); }}
                      className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                      style={{
                        backgroundColor: formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.bgCard,
                        color: formPrimaryRole === jr.id ? theme.colors.white : theme.colors.grayDark,
                        border: `1px solid ${formPrimaryRole === jr.id ? theme.colors.primary : theme.colors.border}`,
                      }}>
                      {formPrimaryRole === jr.id ? '★ Primary' : 'Set Primary'}
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {formError && <p className="text-xs" style={{ color: theme.colors.danger }}>{formError}</p>}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Team Management ({users.length})</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => { resetForm(); setShowAdd(true); }}>Add New Staff</Button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.colors.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ backgroundColor: theme.colors.bgElevated, borderBottom: `1px solid ${theme.colors.border}` }}>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Staff</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Username</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Role</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Job Roles</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.grayDark }}>Status</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: theme.colors.grayDark }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((staff) => {
                if (!staff || !staff.id) return null;
                const staffJobRoles = getJobRoleNames(staff.id);
                const displayName = getDisplayName(staff);
                const initial = getUserInitial(staff);
                return (
                  <tr key={staff.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: alpha(theme.colors.primary, '20'), color: theme.colors.primaryLight }}>
                          {initial}
                        </div>
                        <span className="text-xs font-medium" style={{ color: theme.colors.white }}>{displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: theme.colors.grayDark }}>{staff.username}</td>
                    <td className="px-4 py-2.5"><Badge color={ROLE_BADGE_COLOR[staff.role]} size="xs">{ROLE_LABELS[staff.role]}</Badge></td>
                    <td className="px-4 py-2.5">
                      {staffJobRoles.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {staffJobRoles.map((r) => (
                            <span key={r.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: r.roleColor, color: '#FFFFFF' }}>
                              {r.roleName}{r.isPrimary ? ' ★' : ''}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge color={staff.isActive ? 'success' : 'danger'} size="xs">{staff.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end">
                        <ActionsMenu onEdit={() => openEdit(staff)} onDelete={() => setConfirmDelete(staff)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-xs" style={{ color: theme.colors.grayDark }}>No staff members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add New Staff"
        footer={<><Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleAdd}>Create Staff</Button></>}>
        {roleForm}
      </Modal>

      <Modal open={!!editingStaff} onClose={() => { setEditingStaff(null); resetForm(); }} title="Edit Staff"
        footer={<><Button variant="outline" onClick={() => { setEditingStaff(null); resetForm(); }}>Cancel</Button>
          <Button onClick={handleEditSave}>Save Changes</Button></>}>
        {roleForm}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => { setConfirmDelete(null); setDeleteError(''); }} title="Delete Staff Member"
        footer={<><Button variant="outline" onClick={() => { setConfirmDelete(null); setDeleteError(''); }}>Cancel</Button>
          <Button variant="secondary" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</Button></>}>
        <p className="text-sm" style={{ color: theme.colors.gray }}>
          This permanently deletes <strong style={{ color: theme.colors.white }}>{confirmDelete?.displayName}</strong> and their login access. Their past attendance and request history may be affected. This cannot be undone.
        </p>
        {deleteError && <p className="text-xs mt-3" style={{ color: theme.colors.danger }}>{deleteError}</p>}
      </Modal>
    </div>
  );
}
