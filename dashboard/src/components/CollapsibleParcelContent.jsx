import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleParcelContent({
  title,
  children,
  defaultOpen = false,
  className = '',
  buttonClassName = 'flex items-center gap-1.5 w-full text-left rounded-lg hover:bg-slate-100/70 -mx-1 px-1 py-1 transition-colors text-inherit',
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
        <div className="flex-1 min-w-0">{title}</div>
      </button>
      {open ? children : null}
    </div>
  );
}
