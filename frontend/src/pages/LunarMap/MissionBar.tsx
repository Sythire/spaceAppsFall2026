import { GRADE_LABEL, MISSION_PROFILES, type GradeResult, type MissionProfile } from '../../utils/missionProfiles';

interface Props { value: string; onChange: (id: string) => void; }

/** "What kind of mission?" bullets; the chosen profile grades the site readouts green / yellow / red. */
export function MissionBar({ value, onChange }: Props) {
 const profile = MISSION_PROFILES.find(p => p.id === value) ?? null;
 return <section className="panel mission-bar" aria-label="Mission type for colour grading">
  <fieldset>
   <legend>Choose a mission type</legend>
   <div className="mission-options">
    <label className="checkbox"><input type="radio" name="mission-type" checked={!profile} onChange={() => onChange('')} />No grading</label>
    {MISSION_PROFILES.map(p => <label className="checkbox" key={p.id}><input type="radio" name="mission-type" checked={value === p.id} onChange={() => onChange(p.id)} />{p.name}</label>)}
   </div>
  </fieldset>
  {profile ? <div className="mission-detail">
   <p className="muted">{profile.summary} <span className="grade-key"><span className="grade grade-good">{GRADE_LABEL.good}</span><span className="grade grade-edge">{GRADE_LABEL.edge}</span><span className="grade grade-bad">{GRADE_LABEL.bad}</span><span className="grade grade-unknown">{GRADE_LABEL.unknown}</span><span className="grade grade-irrelevant">{GRADE_LABEL.irrelevant}</span></span></p>
   <ul className="mission-criteria">{profile.criteria.map(c => <li key={c.metric}><strong>{c.requirement}</strong> · <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>{c.source.note ? <small> — {c.source.note}</small> : null}</li>)}</ul>
   <small className="muted">Only sourced limits are graded. Black: relevant, no site data. Grey: not relevant. Yellow: within 20% of a limit (5% for ice temperature). The 1.9 km LOLA grid cannot resolve lander-scale hazards.</small>
  </div> : <p className="muted">Select a mission type to assess conditions against published limits.</p>}
 </section>;
}

/** Small badge + hover detail for a graded readout. */
export function GradeBadge({ result }: { result: GradeResult }) {
 // Only show badges for metrics this mission type has a limit for (graded or missing data).
 if (result.grade === 'na' || result.grade === 'irrelevant') return null;
 const tip = [result.reason, result.source ? `Source: ${result.source.label}` : '', result.source?.note ?? ''].filter(Boolean).join('\n');
 return <span className={`grade grade-${result.grade}`} title={tip}>{GRADE_LABEL[result.grade]}{result.requirement ? ` · ${result.requirement}` : ''}</span>;
}

export const profileById = (id: string): MissionProfile | null => MISSION_PROFILES.find(p => p.id === id) ?? null;
