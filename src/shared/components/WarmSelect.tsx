import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface WarmSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}

const WarmSelect: React.FC<WarmSelectProps> = ({ value, onChange, options, placeholder = 'Choose...', className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-52 items-center justify-between gap-2 rounded-xl border border-[#d1c5b0] bg-white px-3 py-2 text-sm text-[#4d4636] outline-none transition hover:border-[#c4b99a] focus:border-[#765b00] focus:ring-2 focus:ring-[#765b00]/20"
      >
        <span className={selected ? 'text-[#1a1c1a]' : 'text-[#7f7664]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#7f7664] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-[#d1c5b0] bg-white shadow-[0_4px_16px_rgba(118,91,0,0.12)]">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center px-4 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'bg-[#765b00] text-white font-semibold'
                    : 'text-[#1a1c1a] hover:bg-[#1a1c1a] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WarmSelect;
