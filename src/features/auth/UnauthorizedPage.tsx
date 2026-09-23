import { ShieldX } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function UnauthorizedPage() {
  return (
    <EmptyState
      icon={ShieldX}
      title="You don't have access to this page"
      description="Ask an administrator if you think you should have access."
      className="my-8"
    />
  );
}
