import {createElement} from 'react';
import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import {SitePicker} from '../../components/shared/SitePicker';
import {MockNotice} from '../../components/shared/AsyncState';
import {VirtualMoonTour} from '../../components/shared/VirtualMoonTour';

function attachMoonModel(node:HTMLElement|null){
 if(!node)return;
 const attributes:Record<string,string>={
  src:'/moon_small.glb',alt:'Interactive Moon from NASA Lunar Reconnaissance Orbiter data. Drag or use arrow keys to rotate.',
  'camera-controls':'','touch-action':'pan-y','interaction-prompt':'none','loading':'eager',
  'shadow-intensity':'0','camera-target':'0m 0m 0m','camera-orbit':'25deg 72deg 6.3m','field-of-view':'30deg',
  'min-camera-orbit':'auto auto 2.8m','max-camera-orbit':'auto auto 8m'
 };
 for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
}
function MoonGlobe(){return createElement('model-viewer',{ref:attachMoonModel,className:'nasa-moon-model'})}
export default function Dashboard(){return <div className="home-page">
 <section className="welcome-hero">
  <div className="welcome-copy"><span className="hero-kicker">An interactive lunar atlas</span><h1>The Moon,<br/><em>in a new light.</em></h1>
   <p>Find a place on the lunar surface. Follow the light, see Earth from a different perspective, and explore the possibilities.</p>
   <div className="hero-buttons"><Link className="primary-action" to="/explorer">Open the explorer <ArrowUpRight size={18}/></Link><Link className="hero-secondary" to="/missions">The next missions <ArrowUpRight size={16}/></Link></div>
  </div>
  <div className="welcome-art"><span className="orbital-cross cross-top" aria-hidden="true">+</span><MoonGlobe/><span className="art-caption">Lunar Reconnaissance Orbiter <span>NASA / GSFC</span></span><span className="orbital-cross cross-bottom" aria-hidden="true">+</span></div>
  <div className="hero-baseline"><span>Location · Light · Perspective</span><span>Drag the globe to explore <span aria-hidden="true">↗</span></span></div>
 </section>
 <section className="home-routes" aria-label="Ways to explore">
  <Link to="/explorer"><span className="route-number">01 / Discover</span><h2>A place on the Moon <ArrowUpRight size={21}/></h2><p>Explore the surface and choose a location.</p></Link>
  <Link to="/analysis"><span className="route-number">02 / Understand</span><h2>Follow the light <ArrowUpRight size={21}/></h2><p>See daylight, darkness, and the view of Earth.</p></Link>
  <Link to="/comparison"><span className="route-number">03 / Compare</span><h2>A different perspective <ArrowUpRight size={21}/></h2><p>Read the conditions at each site side by side.</p></Link>
 </section>
 <details className="disclosure home-disclosure"><summary>A guided journey across the Moon</summary><VirtualMoonTour/></details>
 <details className="disclosure home-disclosure"><summary>The location collection</summary><SitePicker/></details>
 <MockNotice/>
 <p className="image-credit">Lunar model courtesy of NASA Goddard Space Flight Center. <a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noreferrer">Image & model credits ↗</a></p>
</div>}
