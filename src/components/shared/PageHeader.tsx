import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or other controls shown on the right. */
  actions?: ReactNode;
  /** Shows a back button that calls this handler. */
  onBack?: () => void;
  className?: string;
}

/** Title row for a page or sub-view. Use once at the top of each screen. */
export function PageHeader({ title, description, actions, onBack, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2">
        {onBack && (
          <Button variant="ghost" size="icon" className="-ml-2 shrink-0" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
