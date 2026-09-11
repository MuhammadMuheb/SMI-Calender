import { useState } from 'react';
import { Card, Badge, Button, Modal, FormInput, Icons } from '../../components/ui';
import { theme } from '../../config/theme';
import { alpha } from '../../utils/themeColor';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { todayStr } from '../../utils/dateUtils';

interface Props { onBack: () => void }

export default function SpecialDayEditor({ onBack }: Props) {
  const { user } = useAuth();
  const { specialDays, addSpecialDay, deleteSpecialDay } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formConsumes, setFormConsumes] = useState(false);
  const [formError, setFormError] = useState('');

  const handleAdd = () => {
    if (!formName.trim() || !formDate) { setFormError('Name and date required'); return; }
    addSpecialDay({
      name: formName.trim(), date: formDate, consumesBalance: formConsumes,
      appliesToAll: true, appliesTo: [], createdBy: user?.id ?? '',
    }, user?.displayName ?? 'Admin');
    setFormName(''); setFormDate(''); setFormConsumes(false); setFormError(''); setShowAdd(false);
  };

  const sortedDays = [...specialDays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: theme.colors.primary }}>← Back</button>
          <h2 className="text-base font-bold" style={{ color: theme.colors.white }}>Special Days</h2>
        </div>
        <Button variant="primary" size="sm" icon={Icons.plus} onClick={() => setShowAdd(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {sortedDays.map((day) => (
          <Card key={day.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: theme.colors.white }}>{day.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px]" style={{ color: theme.colors.grayDark }}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <Badge color={day.consumesBalance ? 'warning' : 'success'} size="xs">
                    {day.consumesBalance ? 'Consumes Balance' : 'Extra Day Off'}
                  </Badge>
                </div>
              </div>
              <button onClick={() => deleteSpecialDay(day.id, user?.displayName ?? 'Admin')}
                className="text-[10px] px-2 py-1 rounded cursor-pointer"
                style={{ color: theme.colors.danger, backgroundColor: theme.colors.bgCard }}>
                Delete
              </button>
            </div>
          </Card>
        ))}
        {sortedDays.length === 0 && (
          <Card>
            <div className="h-16 flex items-center justify-center rounded-lg" style={{ border: `1px dashed ${theme.colors.border}` }}>
              <p className="text-xs" style={{ color: theme.colors.grayDark }}>No special days</p>
            </div>
          </Card>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Special Day"
        footer={<><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create</Button></>}>
        <FormInput label="Name" placeholder="e.g. Company Team Day" value={formName} onChange={(e) => setFormName(e.target.value)} />
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Date</label>
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} min={todayStr()}
            className="w-full rounded-lg text-sm px-3 py-2.5"
            style={{ backgroundColor: theme.colors.bgCard, border: `1px solid ${theme.colors.border}`, color: theme.colors.white, colorScheme: 'dark' }} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: theme.colors.gray }}>Balance Impact</label>
          <div className="space-y-2">
            <button onClick={() => setFormConsumes(false)} className="w-full text-left px-3 py-2 rounded-lg cursor-pointer"
              style={{
                backgroundColor: !formConsumes ? alpha(theme.colors.success, '15') : theme.colors.bgCard,
                border: `1px solid ${!formConsumes ? theme.colors.success : theme.colors.border}`,
              }}>
              <p className="text-xs font-medium" style={{ color: theme.colors.white }}>Extra Day Off</p>
              <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Does NOT consume any balance — a gift day</p>
            </button>
            <button onClick={() => setFormConsumes(true)} className="w-full text-left px-3 py-2 rounded-lg cursor-pointer"
              style={{
                backgroundColor: formConsumes ? alpha(theme.colors.warning, '15') : theme.colors.bgCard,
                border: `1px solid ${formConsumes ? theme.colors.warning : theme.colors.border}`,
              }}>
              <p className="text-xs font-medium" style={{ color: theme.colors.white }}>Consumes Balance</p>
              <p className="text-[10px]" style={{ color: theme.colors.grayDark }}>Uses 1 regular day-off from staff balance</p>
            </button>
          </div>
        </div>
        {formError && <p className="text-xs" style={{ color: theme.colors.danger }}>{formError}</p>}
      </Modal>
    </div>
  );
}
