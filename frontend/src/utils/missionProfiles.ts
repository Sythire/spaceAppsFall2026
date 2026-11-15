/**
 * Mission-type grading for site metrics: green = within the published limit with margin, yellow = at the
 * edge (within the margin band) or at risk, red = beyond the limit, black = relevant but not graded because the
 * data is unavailable, grey = not relevant (no published number for this mission type). With no mission
 * type selected nothing is graded ('na'). Every threshold carries its source; a metric with no published limit for
 * a mission type is left ungraded rather than given an invented threshold.
 */
export type Grade = 'good' | 'edge' | 'bad' | 'unknown' | 'irrelevant' | 'na';
export type MetricKey = 'slope' | 'longestSunlit' | 'longestDark' | 'earthVisible' | 'commOutage' | 'dayMaxTemp' | 'psr';

export interface Source { label: string; url: string; note?: string; }
export interface Criterion {
 metric: MetricKey;
 /** Human-readable requirement, e.g. "≤ 10° landing slope". */
 requirement: string;
 /** 'max': value must be ≤ limit; 'min': value must be ≥ limit; 'true' / 'false': boolean requirement. */
 kind: 'max' | 'min' | 'true' | 'false';
 limit?: number;
 /** Yellow band width as a fraction of the limit (default 20%): e.g. 8–10° for a 10° max. */
 margin?: number;
 source: Source;
}
export interface MissionProfile { id: string; name: string; summary: string; criteria: Criterion[]; }

export const SOURCES = {
 artemisRegions: { label: 'NASA: candidate regions for Artemis III (2022)', url: 'https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/' },
 hls2024: { label: 'NASA Artemis HLS Update 2024 (NTRS 20240009596)', url: 'https://ntrs.nasa.gov/citations/20240009596',
  note: 'Slide figures as quoted in search results; the PDF text could not be machine-read here — verify on the slide.' },
 viper2022: { label: 'NASA VIPER mission planning, SpaceOps 2022 (NTRS 20220008301)', url: 'https://ntrs.nasa.gov/citations/20220008301',
  note: 'Figures as quoted in search results and NASA’s Nobile selection announcement; verify on the slides.' },
 apolloLm: { label: 'NASA ALHAT presentation: Apollo LM tolerated ≤12° from vertical', url: 'https://ntrs.nasa.gov/citations/20080009586',
  note: 'Historical Apollo design value, not a current requirement.' },
 iceColdTrap: { label: 'Schörghofer (2025) review; Paige et al. (2010) Diviner cold traps: ~110 K for H₂O', url: 'https://arxiv.org/abs/2502.06056',
  note: 'Ice sublimation rises ~10× between 109 K and 114 K.' },
} satisfies Record<string, Source>;

export const MISSION_PROFILES: MissionProfile[] = [
 {
  id: 'crewed', name: 'Crewed landing (Artemis HLS)',
  summary: 'Human Landing System: gentle slope and a long sunlit stay.',
  criteria: [
   { metric: 'slope', requirement: '≤ 10° landing slope', kind: 'max', limit: 10, source: SOURCES.hls2024 },
   { metric: 'longestSunlit', requirement: '≥ 6.5 days (156 h) continuous sunlight', kind: 'min', limit: 156, source: SOURCES.artemisRegions },
  ],
 },
 {
  id: 'solar-rover', name: 'Solar rover (VIPER-type)',
  summary: 'Solar-powered rover: drivable slopes and short darkness it can survive on batteries.',
  criteria: [
   { metric: 'slope', requirement: '≤ 15° driving slope', kind: 'max', limit: 15, source: SOURCES.viper2022 },
   { metric: 'longestDark', requirement: '≤ 50 h continuous darkness', kind: 'max', limit: 50, source: SOURCES.viper2022 },
  ],
 },
 {
  id: 'robotic-lander', name: 'Robotic lander (Apollo-era tilt reference)',
  summary: 'Uses the Apollo Lunar Module’s 12° tilt tolerance as a reference; check your lander’s own limit.',
  criteria: [
   { metric: 'slope', requirement: '≤ 12° from vertical', kind: 'max', limit: 12, source: SOURCES.apolloLm },
  ],
 },
 {
  id: 'ice', name: 'Ice prospector (cold trap)',
  summary: 'Volatiles science: water ice survives only where the surface stays below ~110 K.',
  criteria: [
   { metric: 'dayMaxTemp', requirement: '≤ 110 K maximum temperature', kind: 'max', limit: 110, margin: 0.05, source: SOURCES.iceColdTrap },
  ],
 },
];

export interface GradeResult { grade: Grade; requirement?: string; reason: string; source?: Source; }

/** Grade one metric for a mission profile: 'unknown' = has a limit but no data; 'irrelevant' = no published
 *  limit for this mission type; 'na' = no mission type chosen. */
export function gradeMetric(profile: MissionProfile | null, metric: MetricKey, value: number | boolean | null | undefined): GradeResult {
 const c = profile?.criteria.find(x => x.metric === metric);
 if (!profile) return { grade: 'na', reason: 'Choose a mission type to grade' };
 if (!c) return { grade: 'irrelevant', reason: 'Not relevant: no published limit for this mission type' };
 if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value)))
  return { grade: 'unknown', requirement: c.requirement, reason: 'Not graded: data not available for this site', source: c.source };
 if (c.kind === 'true' || c.kind === 'false') {
  const ok = Boolean(value) === (c.kind === 'true');
  return { grade: ok ? 'good' : 'bad', requirement: c.requirement, reason: ok ? 'Meets requirement' : 'Does not meet requirement', source: c.source };
 }
 const v = Number(value), limit = c.limit!, band = Math.abs(limit) * (c.margin ?? 0.2);
 let grade: Grade;
 if (c.kind === 'max') grade = v > limit ? 'bad' : v > limit - band ? 'edge' : 'good';
 else grade = v < limit ? 'bad' : v < limit + band ? 'edge' : 'good';
 const reason = grade === 'bad' ? `Outside the limit (${c.requirement})` : grade === 'edge' ? `Within ${Math.round((c.margin ?? 0.2) * 100)}% of the limit (${c.requirement})` : `Meets ${c.requirement} with margin`;
 return { grade, requirement: c.requirement, reason, source: c.source };
}

export const GRADE_LABEL: Record<Grade, string> = { good: '✓ In range', edge: '! At the edge', bad: '✕ Out of range', unknown: '? Not graded (no data)', irrelevant: '– Not relevant', na: '' };

/** Combine several grades for one card: a real verdict (worst first) wins, then 'unknown', then 'irrelevant'. */
export function combineGrades(...grades: Grade[]): Grade {
 return (['bad', 'edge', 'good', 'unknown', 'irrelevant'] as Grade[]).find(g => grades.includes(g)) ?? 'na';
}

/** Card class for a readout: cards with no gradeable metric are 'not relevant' once a mission type is chosen. */
export function gradeClass(profile: MissionProfile | null, grade?: Grade): string {
 if (!profile) return '';
 return ' graded-' + (grade && grade !== 'na' ? grade : 'irrelevant');
}
