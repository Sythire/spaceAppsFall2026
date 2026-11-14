import { siteService } from '../../services/siteService';
import { useAsync } from '../../hooks/useAsync';
import { useAppState } from '../../context/AppContext';
import { AsyncState } from './AsyncState';
import { isMockMode } from '../../services/apiClient';

export function SitePicker() {
  const state = useAppState();
  const resource = useAsync(siteService.getSites);

  return (
    <>
      <AsyncState {...resource} empty={resource.data?.length === 0} />
      <div className="site-grid">
        {resource.data?.map(site => {
          const active = state.location?.id === site.id;
          const comparing = state.selectedSites.some(s => s.id === site.id);
          const latitude = `${Math.abs(site.latitudeDeg).toFixed(2)}° ${site.latitudeDeg < 0 ? 'S' : 'N'}`;
          const longitude = `${Math.abs(site.longitudeDeg).toFixed(2)}° ${site.longitudeDeg < 0 ? 'W' : 'E'}`;
          const tag = isMockMode
            ? 'SIMULATED CANDIDATE'
            : site.kind === 'historical'
              ? 'NASA HISTORICAL SITE'
              : 'HYPOTHETICAL TEST SITE';

          return (
            <article className={`panel site-card${active ? ' is-selected' : ''}`} key={site.id}>
              <div className="site-card-top">
                <span className="tag">{tag}</span>
                {active && <span className="site-selected-mark">Selected</span>}
              </div>
              <h3>{site.name}</h3>
              <p className="site-coordinates">
                <span aria-hidden="true">⌖</span>
                {latitude} <i>·</i> {longitude}
              </p>
              {site.source && (
                <p>
                  <a href={site.source} target="_blank" rel="noreferrer">
                    Coordinate source ↗
                  </a>
                </p>
              )}
              <div className="button-row">
                <button className={active ? 'active' : ''} aria-pressed={active} onClick={() => state.setLocation(site)}>
                  {active ? 'Selected' : 'Use for analysis'}
                </button>
                <button
                  aria-pressed={comparing}
                  disabled={state.selectedSites.length === 3 && !comparing}
                  onClick={() => state.toggleSite(site)}
                >
                  {comparing ? 'Remove' : 'Compare +'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
