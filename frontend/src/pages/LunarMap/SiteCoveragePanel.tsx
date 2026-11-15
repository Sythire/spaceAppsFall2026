import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Equipment, SiteCoverage } from '../../types';
import { combineGrades, gradeClass, gradeMetric, type MissionProfile } from '../../utils/missionProfiles';
import { GradeBadge } from './MissionBar';

interface Props { data: SiteCoverage | null; loading: boolean; error: string; equipment: Equipment; missionProfile?: MissionProfile | null; }

const fmtH = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(0)} h`);

/** Daily roll-up of the hourly series, for the accessible table. */
export function dailySummary(d: SiteCoverage) {
 const perDay = Math.round(24 / d.stepHours);
 const days: { day: number; sunlitH: number; energyWh: number; earthH: number }[] = [];
 for (let i = 0; i < d.series.utc.length; i += perDay) {
  const sl = (a: unknown[]) => a.slice(i, i + perDay);
  days.push({
   day: i / perDay + 1,
   sunlitH: (sl(d.series.sunlit) as boolean[]).filter(Boolean).length * d.stepHours,
   energyWh: (sl(d.series.electricalWm2 ?? d.series.powerWm2) as number[]).reduce((a, b) => a + b, 0) * d.stepHours,
   earthH: (sl(d.series.earthVisible) as boolean[]).filter(Boolean).length * d.stepHours,
  });
 }
 return days;
}

export function SiteCoveragePanel({ data, loading, error, equipment, missionProfile = null }: Props) {
 const points = useMemo(() => data ? data.series.utc.map((_, i) => ({
  day: (i * data.stepHours) / 24,
  sunEl: data.series.sunElevationDeg[i], sunHz: data.series.sunHorizonDeg[i], power: data.series.electricalWm2?.[i] ?? data.series.powerWm2[i],
  earthEl: data.series.earthElevationDeg[i], earthLimit: data.series.earthLimitDeg[i],
 })) : [], [data]);
 const profile = useMemo(() => data ? data.horizonProfile.azimuthDeg.map((az, i) => ({ az, panel: data.horizonProfile.panelDeg[i], comm: data.horizonProfile.commDeg[i] })) : [], [data]);

 return <section className="panel site-coverage" aria-live="polite">
  <h2>Power & communication · next 30 days (terrain-aware)</h2>
  <p className="muted">Panel tilt {equipment.panelTiltDeg}° at {equipment.panelHeightM} m, {equipment.panelEfficiencyPct}% efficient · receiver needs Earth ≥ {equipment.commMaskDeg}° at {equipment.commHeightM} m. Starts at the scenario time.</p>
  {loading && <p className="muted">Computing terrain horizon and hourly geometry…</p>}
  {error && <p role="alert">{error}</p>}
  {data && <>
   <div className="readout-grid">
    {(() => {
     const lit = gradeMetric(missionProfile, 'longestSunlit', data.summary.longestSunlitHours), dark = gradeMetric(missionProfile, 'longestDark', data.summary.longestDarkHours);
     return <article className={'metric metric-sun' + gradeClass(missionProfile, combineGrades(lit.grade, dark.grade))}><span>Sunlit</span><strong>{data.summary.sunlitPct.toFixed(1)}%</strong>
      <small>Longest continuous sunlight {fmtH(data.summary.longestSunlitHours)} · longest darkness {fmtH(data.summary.longestDarkHours)} (battery sizing)</small>
      <GradeBadge result={lit} /><GradeBadge result={dark} /></article>;
    })()}
    <article className={'metric metric-sun' + gradeClass(missionProfile)}><span>Mean electrical output</span><strong>{data.summary.meanElectricalWm2.toFixed(0)} W/m²</strong><small>At {data.summary.panelEfficiencyPct}% efficiency · peak {data.summary.peakElectricalWm2.toFixed(0)} W/m² · {data.summary.electricalKWhPerM2.toFixed(1)} kWh/m² over 30 days · incident sunlight {data.summary.meanPowerWm2.toFixed(0)} W/m² mean</small></article>
    <article className={'metric metric-earth' + gradeClass(missionProfile, combineGrades(gradeMetric(missionProfile, 'earthVisible', data.summary.earthVisiblePct).grade, gradeMetric(missionProfile, 'commOutage', data.summary.longestCommOutageHours).grade))}><span>Earth in view</span><strong>{data.summary.earthVisiblePct.toFixed(1)}%</strong><small>Longest outage {fmtH(data.summary.longestCommOutageHours)} · line of sight only</small></article>
    <article className={'metric' + gradeClass(missionProfile, gradeMetric(missionProfile, 'slope', data.slopeDeg).grade)}><span>Local slope (LOLA)</span><strong>{data.slopeDeg.toFixed(1)}°</strong><small>Over ~3.8 km; panel tilt is added to this ground plane</small><GradeBadge result={gradeMetric(missionProfile, 'slope', data.slopeDeg)} /></article>
   </div>
   <div className="coverage-charts">
    <div className="chart" role="img" aria-label="Sun and Earth elevation against the terrain horizon over 30 days, with panel power">
     <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={points}>
       <CartesianGrid stroke="#263342" strokeDasharray="3 3" />
       <XAxis dataKey="day" type="number" domain={[0, 'dataMax']} stroke="#9aaabc" unit=" d" tickCount={8} />
       <YAxis yAxisId="deg" stroke="#9aaabc" unit="°" domain={['auto', 'auto']} />
       <YAxis yAxisId="w" orientation="right" stroke="#c99a5a" unit=" W" domain={[0, 'auto']} />
       <ReferenceLine yAxisId="deg" y={0} stroke="#aab5c2" strokeDasharray="4 4" />
       <Tooltip contentStyle={{ background: '#142131', borderColor: '#36485e' }} labelFormatter={d => `Day ${Number(d).toFixed(2)}`}
        formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : String(v), String(name)]} />
       <Area yAxisId="w" type="stepAfter" dataKey="power" name="Electrical output (W/m²)" stroke="#e8913b" fill="#e8913b33" isAnimationActive={false} />
       <Line yAxisId="deg" dataKey="sunEl" name="Sun elevation" stroke="#ffd27a" dot={false} isAnimationActive={false} />
       <Line yAxisId="deg" dataKey="sunHz" name="Terrain horizon toward Sun" stroke="#ffd27a" strokeDasharray="4 3" strokeOpacity={0.6} dot={false} isAnimationActive={false} />
       <Line yAxisId="deg" dataKey="earthEl" name="Earth elevation" stroke="#6fb7ff" dot={false} isAnimationActive={false} />
       <Line yAxisId="deg" dataKey="earthLimit" name="Earth limit (terrain / mask)" stroke="#6fb7ff" strokeDasharray="4 3" strokeOpacity={0.6} dot={false} isAnimationActive={false} />
      </ComposedChart>
     </ResponsiveContainer>
     <p className="chart-key"><i className="k-sun" />Sun elevation <i className="k-sun dashed" />terrain horizon toward Sun <i className="k-earth" />Earth elevation <i className="k-earth dashed" />Earth limit <i className="k-power" />panel power</p>
    </div>
    <div className="chart" role="img" aria-label="Terrain horizon elevation by compass direction">
     <ResponsiveContainer width="100%" height={260}>
      <LineChart data={profile}>
       <CartesianGrid stroke="#263342" strokeDasharray="3 3" />
       <XAxis dataKey="az" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} stroke="#9aaabc" unit="°" />
       <YAxis stroke="#9aaabc" unit="°" domain={['auto', 'auto']} />
       <ReferenceLine y={0} stroke="#aab5c2" strokeDasharray="4 4" />
       <Tooltip contentStyle={{ background: '#142131', borderColor: '#36485e' }} labelFormatter={a => `Azimuth ${a}°`} formatter={(v, n) => [typeof v === 'number' ? v.toFixed(2) + '°' : String(v), String(n)]} />
       <Line dataKey="panel" name="Horizon at panel height" stroke="#ffd27a" dot={false} isAnimationActive={false} />
       <Line dataKey="comm" name="Horizon at receiver height" stroke="#6fb7ff" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </LineChart>
     </ResponsiveContainer>
     <p className="chart-key">Terrain horizon around the site (0° = north, clockwise)</p>
    </div>
   </div>
   <details><summary>View daily values</summary><div className="table-scroll"><table>
    <thead><tr><th>Day</th><th>Sunlit (h)</th><th>Electrical energy (Wh/m²)</th><th>Earth in view (h)</th></tr></thead>
    <tbody>{dailySummary(data).map(d => <tr key={d.day}><td>{d.day}</td><td>{d.sunlitH.toFixed(0)}</td><td>{d.energyWh.toFixed(0)}</td><td>{d.earthH.toFixed(0)}</td></tr>)}</tbody>
   </table></div></details>
   <p className="scene-source">{data.method}</p>
  </>}
 </section>;
}
