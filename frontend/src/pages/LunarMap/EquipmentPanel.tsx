import { useEffect, useState, type FormEvent } from 'react';
import type { CoverageMode, Equipment } from '../../types';

export const DEFAULT_EQUIPMENT: Equipment = { panelTiltDeg: 0, panelHeightM: 1, commMaskDeg: 0, commHeightM: 1 };

/** Allowed ranges; the backend validates the same limits. */
const FIELDS: { key: keyof Equipment; label: string; min: number; max: number; step: string; help: string }[] = [
 { key: 'panelTiltDeg', label: 'Solar panel tilt · °', min: 0, max: 90, step: 'any', help: '0 = flat; tilted up from the ground, facing the Sun' },
 { key: 'panelHeightM', label: 'Solar panel height · m', min: 0, max: 1000, step: 'any', help: 'Mount height above the ground' },
 { key: 'commMaskDeg', label: 'Comm receiver angle · °', min: -5, max: 90, step: 'any', help: 'Minimum Earth elevation needed for a link' },
 { key: 'commHeightM', label: 'Comm receiver height · m', min: 0, max: 1000, step: 'any', help: 'Antenna height above the ground' },
];

export function validateEquipment(e: Record<keyof Equipment, string | number>): { value: Equipment | null; error: string } {
 const out = { ...DEFAULT_EQUIPMENT };
 for (const f of FIELDS) {
  const raw = e[f.key];
  const v = typeof raw === 'number' ? raw : raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(v) || v < f.min || v > f.max) return { value: null, error: `${f.label.split(' · ')[0]} must be ${f.min} to ${f.max}.` };
  out[f.key] = v;
 }
 return { value: out, error: '' };
}

interface Props { equipment: Equipment; mode: CoverageMode; onApply: (e: Equipment) => void; onModeChange: (m: CoverageMode) => void; }

export function EquipmentPanel({ equipment, mode, onApply, onModeChange }: Props) {
 const [draft, setDraft] = useState<Record<keyof Equipment, string>>(() => toDraft(equipment));
 const [error, setError] = useState('');
 useEffect(() => setDraft(toDraft(equipment)), [equipment]);
 function submit(ev: FormEvent<HTMLFormElement>) {
  ev.preventDefault();
  const { value, error: err } = validateEquipment(draft);
  setError(err);
  if (value) onApply(value);
 }
 return <form className="equipment" onSubmit={submit} noValidate>
  <h3>Equipment</h3>
  <p className="muted">Used by the Solar power and Earth communication layers and the site statistics. Terrain blocking comes from LOLA.</p>
  {FIELDS.map(f => <label key={f.key} title={f.help}>{f.label}
   <input type="number" inputMode="decimal" step={f.step} min={f.min} max={f.max} value={draft[f.key]}
    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} aria-describedby={`help-${f.key}`} />
   <small id={`help-${f.key}`}>{f.help}</small></label>)}
  <div className="button-row">
   <button type="submit">Apply</button>
   <button type="button" onClick={() => { setDraft(toDraft(DEFAULT_EQUIPMENT)); setError(''); onApply(DEFAULT_EQUIPMENT); }}>Defaults</button>
  </div>
  <p role="alert">{error}</p>
  <fieldset className="mode-switch"><legend>Map statistic</legend>
   <label className="checkbox"><input type="radio" name="coverage-mode" checked={mode === 'instant'} onChange={() => onModeChange('instant')} />Now (viewed time)</label>
   <label className="checkbox"><input type="radio" name="coverage-mode" checked={mode === 'monthly'} onChange={() => onModeChange('monthly')} />Monthly average</label>
  </fieldset>
 </form>;
}

function toDraft(e: Equipment): Record<keyof Equipment, string> {
 return { panelTiltDeg: String(e.panelTiltDeg), panelHeightM: String(e.panelHeightM), commMaskDeg: String(e.commMaskDeg), commHeightM: String(e.commHeightM) };
}
