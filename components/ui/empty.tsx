import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const Empty = ({ title, description, actionLabel, onAction }: EmptyProps) => {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border/60 bg-card/80 px-6 py-16 text-center shadow-inner">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Calendar className="h-6 w-6" />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-primary/30 hover:opacity-90"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default Empty;
