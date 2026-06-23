import { cn } from '@/lib/utils';

export type DropIndicatorEdge = 'before' | 'inside' | 'after';

export function DropIndicator({ edge }: { edge?: DropIndicatorEdge }) {
  if (!edge) {
    return null;
  }
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-primary',
        edge === 'before' && 'top-0',
        edge === 'after' && 'bottom-0',
        edge === 'inside' && 'bottom-0 left-2 right-2',
      )}
    />
  );
}
