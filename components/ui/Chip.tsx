import { clsx } from 'clsx';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
}

export function Chip({ label, selected = false, onClick, removable = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        'border cursor-pointer',
        {
          'bg-primary text-primary-foreground border-primary': selected,
          'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80': !selected,
        }
      )}
    >
      {label}
      {removable && selected && (
        <span className="ml-1 text-xs">✕</span>
      )}
    </button>
  );
}
