import { Moon } from 'lucide-react';
import './overview-footer.css';

export function OverviewFooter() {
  return <footer className="overview-footer" aria-label="About Moonwalk">
    <div className="overview-footer-copy">
      <span className="overview-footer-label">Moonwalk · Your lunar field guide</span>
      <h2>Explore with curiosity. Plan with context.</h2>
      <p>Discover lunar terrain, compare landing sites, and follow the missions ahead.</p>
    </div>
    <div className="overview-footer-note">
      <span className="overview-footer-icon" aria-hidden="true"><Moon size={22} strokeWidth={1.5}/></span>
      <div><strong>Created for NASA Space Apps</strong><span>For everyone curious about the Moon.</span></div>
    </div>
  </footer>;
}
