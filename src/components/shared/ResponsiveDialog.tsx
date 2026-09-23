import type { ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Action buttons; pinned to the bottom of the drawer on mobile. */
  footer?: ReactNode;
  /** Dialog width on desktop. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * A modal that is a centered dialog on desktop and a bottom drawer on phones,
 * so forms stay thumb-reachable on mobile.
 */
export function ResponsiveDialog({
  open, onOpenChange, title, description, children, footer, size = 'md', className,
}: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop(768);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0', widths[size], className)}>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <DialogFooter className="m-0 border-t px-6 py-4">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('max-h-[92vh]', className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <DrawerFooter className="border-t pb-safe">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
