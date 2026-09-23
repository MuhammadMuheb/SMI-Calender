import { TranslatedText } from '@/i18n/LanguageContext';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppData } from '@/app/AppDataContext';
import { useAuth } from '@/features/auth/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
interface Response { id: string; userId: string; title: string; confirmStatus: string; rejectReason: string; createdAt: string }
export default function ShiftStatusBoard({ onBack }: { onBack: () => void }) {
  const { users } = useAppData();
  const { user } = useAuth();
  const [responses, setResponses] = useState<Response[]>([]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, 'notifications'), where('type', '==', 'daily_absence_summary')), snapshot => setResponses(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Response).filter(r => r.confirmStatus && /shift|turno/i.test(r.title || '')).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))), () => toast.error('Unable to load shift responses'));
  }, [user]);
  return <div className="space-y-4"><PageHeader title="Shift responses" description="Live confirmations and declined shift notifications." onBack={onBack} />
    {responses.length === 0 ? <p className="text-muted-foreground">No shift responses yet.</p> : <div className="overflow-auto rounded border"><table className="w-full text-left text-sm"><thead><tr><th className="p-3"><TranslatedText text="Person" /></th><th>Shift</th><th><TranslatedText text="Status" /></th><th><TranslatedText text="Reason" /></th></tr></thead><tbody>{responses.map(r => <tr key={r.id} className="border-t"><td className="p-3">{users.find(u => u.id === r.userId)?.displayName || r.userId}</td><td>{r.title}</td><td>{r.confirmStatus}</td><td>{r.rejectReason || '-'}</td></tr>)}</tbody></table></div>}
  </div>;
}
