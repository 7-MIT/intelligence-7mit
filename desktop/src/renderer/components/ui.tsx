import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Logo({ size = 34 }: { size?: number }) {
  return <span className="brand-mark" style={{ width: size, height: size }} aria-hidden><i /><i /><i /></span>;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cb(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [on, cb, ref]);
}

export interface Option<T extends string> { value: T; label: string; hint?: string; icon?: ReactNode; disabled?: boolean }
/** Dropdown kustom (bukan <select> bawaan OS). */
export function Dropdown<T extends string>({ value, options, onChange, label, width }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="dd" ref={ref}>
      <button className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={label} style={{ minWidth: width }} onClick={() => setOpen((o) => !o)}>
        {cur?.icon}<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur?.label ?? '—'}</span><ChevronDown size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="dd-menu" role="listbox" initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .12 }}>
            {options.map((o) => (
              <button key={o.value} role="option" aria-selected={o.value === value} disabled={o.disabled} className={`dd-item ${o.value === value ? 'on' : ''}`} onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.icon}<span style={{ flex: 1 }}>{o.label}{o.hint && <small style={{ display: 'block', color: 'var(--faint)' }}>{o.hint}</small>}</span>{o.value === value && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface MenuItem { label: string; icon?: ReactNode; danger?: boolean; onClick: () => void }
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, onClose, true);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(x, innerWidth - r.width - 8), y: Math.min(y, innerHeight - r.height - 8) });
  }, [x, y]);
  return createPortal(
    <motion.div ref={ref} className="ctx" role="menu" style={{ left: pos.x, top: pos.y }} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .1 }}>
      {items.map((it) => (
        <button key={it.label} role="menuitem" className="dd-item" style={it.danger ? { color: 'var(--red)' } : undefined} onClick={() => { onClose(); it.onClick(); }}>{it.icon}{it.label}</button>
      ))}
    </motion.div>, document.body);
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  const t = useRef<number>();
  return (
    <span style={{ display: 'inline-flex' }}
      onMouseEnter={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); t.current = window.setTimeout(() => setP({ x: r.left + r.width / 2, y: r.bottom + 8 }), 350); }}
      onMouseLeave={() => { clearTimeout(t.current); setP(null); }}>
      {children}
      {p && createPortal(<div className="tip" role="tooltip" style={{ left: Math.max(8, Math.min(p.x - 80, innerWidth - 290)), top: p.y }}>{text}</div>, document.body)}
    </span>
  );
}

export function Modal({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label: string }) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal" role="dialog" aria-modal="true" aria-label={label} initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 24, stiffness: 300 }}>{children}</motion.div>
    </motion.div>, document.body);
}

export function Typing() { return <span className="typing" aria-label="AI sedang bekerja"><i /><i /><i /></span>; }

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return <div className="empty"><div><div className="glow">{icon ?? <Logo size={34} />}</div><h1>{title}</h1>{children}</div></div>;
}
