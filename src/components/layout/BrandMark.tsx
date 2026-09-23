import { cn } from '@/lib/utils';

/** The Show Me Italy logo tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/icons/logo.png"
      alt=""
      aria-hidden="true"
      className={cn('shrink-0 rounded-lg border object-cover', className)}
    />
  );
}
