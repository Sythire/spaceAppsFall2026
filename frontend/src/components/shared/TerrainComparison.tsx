import { useCallback, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { coverageService, sceneService } from '../../services/sceneService';
import { loadSavedEquipment } from '../../pages/LunarMap/EquipmentPanel';
import type { LunarLocation, SiteCoverage, SiteGeometry } from '../../types';

interface Row { label: string; value: (c: SiteCoverage, g: SiteGeometry) => string; }
const h = (x: number) => (x >= 48 ? `${(x / 24).toFixed(1)} d` : `${x.toFixed(0)} h`);
const ROWS: Row[] = [
 { label: 'Sunlit (terrain-aware)', value: c => c.summary.sunlitPct.toFixed(1) + '%' },
 { label: 'Longest darkness', value: c => h(c.summary.longestDarkHours) },
 { label: 'Mean panel power', value: c => c.summary.meanPowerWm2.toFixed(0) + ' W/m²' },
 { label: 'Panel energy', value: c => c.summary.energyKWhPerM2.toFixed(0) + ' kWh/m²' },
 { label: 'Earth in view (terrain-aware)', value: c => c.summary.earthVisiblePct.toFixed(1) + '%' },
 { label: 'Longest comm outage', value: c => h(c.summary.longestCommOutageHours) },
 { label: 'Local slope (LOLA)', value: c => c.slopeDeg.toFixed(1) + '°' },
 { label: 'Permanent shadow (LOLA PSR)', value: (_, g) => g.terrain?.permanentlyShadowed === true ? 'Yes' : g.terrain?.permanentlyShadowed === false ? 'No' : 'Outside map' },
 { label: 'Diviner day max / night min', value: (_, g) => g.thermal?.dayMaxK != null ? `${g.thermal.dayMaxK.toFixed(0)} K / ${g.thermal.nightMinK?.toFixed(0) ?? '—'} K` : 'Not available' },
];

/** Terrain-aware power, communication, PSR and temperature for the compared sites, with the Explorer's equipment. */
export function TerrainComparison({ sites, utc, days }: { sites: LunarLocation[]; utc: string; days: number }) {
 const equipment = useMemo(loadSavedEquipment, []);
 const span = Math.min(60, Math.max(1, days));
 const load = useCallback(() => sites.length < 2 ? Promise.resolve(null) : Promise.all(sites.map(s => Promise.all([
  coverageService.site(s.latitudeDeg, s.longitudeDeg, utc, equipment, span), sceneService.site(s.latitudeDeg, s.longitudeDeg, utc),
 ]))), [sites, utc, equipment, span]);
 const r = useAsync(load);
 if (sites.length < 2) return null;
 return <section className="terrain-comparison">
  <h3>Terrain-aware power, communication, shadow and temperature</h3>
  <p className="muted">Over {span} days from the start time · panel tilt {equipment.panelTiltDeg}° at {equipment.panelHeightM} m · receiver needs Earth ≥ {equipment.commMaskDeg}° at {equipment.commHeightM} m (set on the Lunar Explorer page).</p>
  {r.loading && <p className="muted">Computing terrain horizons for each site…</p>}
  {r.error && <p role="alert">{r.error} <button type="button" onClick={r.retry}>Retry</button></p>}
  {r.data && <div className="table-scroll"><table>
   <thead><tr><th>Metric</th>{sites.map(s => <th key={s.id}>{s.name}</th>)}</tr></thead>
   <tbody>{ROWS.map(row => <tr key={row.label}><th>{row.label}</th>{r.data!.map(([c, g], i) => <td key={sites[i].id}>{row.value(c, g)}</td>)}</tr>)}</tbody>
  </table></div>}
  <p className="muted">LOLA terrain horizons (1.9 km DEM), SPICE geometry, official LOLA PSR map, LRO Diviner 2010 temperatures. Line of sight only for communication; panel power before conversion losses.</p>
 </section>;
}
