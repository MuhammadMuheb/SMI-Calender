import { useId, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function WorkSelect({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><select id={id} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring" {...props}>{children}</select></div>;
}
export function WorkInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} className="h-11 text-base" {...props} /></div>;
}
export function WorkToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 text-sm"><input className="size-5 accent-primary" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export function WorkFieldset({ label, children }: { label: string; children: ReactNode }) {
  return <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">{label}</legend>{children}</fieldset>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const WEEKDAYS = [{ id: 1, name: 'Monday' }, { id: 2, name: 'Tuesday' }, { id: 3, name: 'Wednesday' }, { id: 4, name: 'Thursday' }, { id: 5, name: 'Friday' }, { id: 6, name: 'Saturday' }, { id: 0, name: 'Sunday' }];
export function WorkDays({ value, onChange, label, allowed = WEEKDAYS.map(d => d.id) }: { value: number[]; onChange: (days: number[]) => void; label: string; allowed?: number[] }) {
  return <WorkFieldset label={label}><div className="flex flex-wrap gap-x-4">{WEEKDAYS.filter(d => allowed.includes(d.id)).map(d => <WorkToggle key={d.id} label={d.name.slice(0, 3)} checked={value.includes(d.id)} onChange={checked => onChange(checked ? [...value, d.id] : value.filter(v => v !== d.id))} />)}</div></WorkFieldset>;
}
