import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

interface ShiftStatusBoardProps {
  onBack: () => void;
}

export default function ShiftStatusBoard({ onBack }: ShiftStatusBoardProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift status"
        description="Who has responded to their shift notifications."
        onBack={onBack}
      />
      <EmptyState
        icon={ClipboardList}
        title="Shift status isn’t available yet"
        description="Shift responses are still being moved to the new database. They’ll show up here once that’s done."
      />
    </div>
  );
}
