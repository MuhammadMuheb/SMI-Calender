import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';

interface Props { onBack: () => void }

export default function RoleManagement({ onBack }: Props) {
  const { user } = useAuth();
  const { jobRoles, addJobRole, updateJobRole, deleteJobRole } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#138A52');
  const [formHidden, setFormHidden] = useState(false);
  const [formStart, setFormStart] = useState('08:00');
  const [formEnd, setFormEnd] = useState('17:00');
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setFormName(''); setFormColor('#138A52'); setFormHidden(false);
    setFormStart('08:00'); setFormEnd('17:00'); setFormError('');
  };

  const handleAdd = () => {
    if (!formName.trim()) { setFormError('Name required'); return; }
    addJobRole({
      name: formName.trim(), color: formColor, isHidden: formHidden,
      shiftStartTime: formStart, shiftEndTime: formEnd,
    }, user?.displayName ?? 'Admin');
    resetForm(); setShowAdd(false);
  };

  const toggleHidden = (id: string, current: boolean) => {
    updateJobRole(id, { isHidden: !current }, user?.displayName ?? 'Admin');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Job Roles</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowAdd(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {jobRoles.map((role) => (
          <Card key={role.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{role.name}</p>
                    {role.isHidden && <Badge color="warning" size="xs">Hidden</Badge>}
                  </div>
                  <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                    {role.shiftStartTime} – {role.shiftEndTime}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => toggleHidden(role.id, role.isHidden)}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                  style={{ color: theme.colors.warning, backgroundColor: theme.colors.bgCard }}>
                  {role.isHidden ? 'Show' : 'Hide'}
                </button>
                <button onClick={() => setConfirmDelete(role.id)}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                  style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="px-1 py-2">
        <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>
          Hidden roles are only visible here. Managers and staff cannot see them, but they still count in staffing calculations.
        </p>
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add Job Role"
        footer={<><Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button><Button onClick={handleAdd}>Create Role</Button></>}>
        <FormInput label="Role Name" placeholder="e.g. Guide" value={formName} onChange={(e) => setFormName(e.target.value)} />
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Color</label>
          <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)}
            className="w-full h-10 rounded-lg cursor-pointer" style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <FormInput label="Shift Start" type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
          <FormInput label="Shift End" type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setFormHidden(!formHidden)}
            className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: formHidden ? theme.colors.warning : theme.colors.bgCard, border: `1px solid ${formHidden ? theme.colors.warning : theme.colors.border}` }}>
            {formHidden && <span className="text-[10px] font-bold" style={{ color: theme.colors.bg }}>✓</span>}
          </button>
          <span className="text-xs" style={{ color: theme.colors.gray }}>Hidden role (only visible to super admin)</span>
        </div>
        {formError && <p className="text-xs" style={{ color: theme.colors.danger }}>{formError}</p>}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Role"
        footer={<><Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => { confirmDelete && deleteJobRole(confirmDelete, user?.displayName ?? 'Admin'); setConfirmDelete(null); }}>Delete</Button></>}>
        <p className="text-sm" style={{ color: theme.colors.gray }}>This will also remove all staff assignments for this role.</p>
      </Modal>
    </div>
  );
}
