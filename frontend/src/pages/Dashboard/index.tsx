import {createElement} from 'react';
import {Link} from 'react-router';
import {ArrowRight,Compass,Orbit,Sparkles} from 'lucide-react';
import {SitePicker} from '../../components/shared/SitePicker';
import {MockNotice} from '../../components/shared/AsyncState';
import {VirtualMoonTour} from '../../components/shared/VirtualMoonTour';

function attachMoonModel(node:HTMLElement|null){
  if(!node)return;
  const attributes:Record<string,string>={
    src:'/moon_small.glb',
    alt:'Interactive 3D Moon model made from NASA Lunar Reconnaissance Orbiter imagery and topographic data. Drag or use arrow keys to rotate.',
    'camera-controls':'','touch-action':'pan-y','interaction-prompt':'none','loading':'eager',
    'shadow-intensity':'0.65','shadow-softness':'0.8','camera-target':'0m 0m 0m',
    'camera-orbit':'25deg 72deg 4.8m','field-of-view':'30deg',
    'min-camera-orbit':'auto auto 2.8m','max-camera-orbit':'auto auto 8m'
  };
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
}
function MoonGlobe(){return createElement('model-viewer',{ref:attachMoonModel,className:'nasa-moon-model'})}

export default function Dashboard(){return <div className="home-page">
  <MockNotice/>
  <section className="welcome-hero">
    <div className="welcome-copy"><span className="hello-pill"><Sparkles size={14}/> YOUR LUNAR FIELD GUIDE</span><h2>Meet the Moon.<br/><em>Pick your landing.</em></h2><p>Rotate NASA’s lunar globe, explore the South Pole, and find out what future missions are looking for.</p><div className="hero-buttons"><Link className="button button-yellow" to="/explorer">Explore landing sites <ArrowRight size={16}/></Link><Link className="hero-secondary" to="/missions">See future missions</Link></div><p className="globe-hint"><span aria-hidden="true">↻</span> Drag to rotate · use arrow keys too</p></div>
    <div className="welcome-art"><div className="moon-orbit" aria-hidden="true"><span/></div><MoonGlobe/><span className="art-caption">NASA LRO DATA · INTERACTIVE 3D</span></div>
  </section>
  <section className="quick-links" aria-label="Explore the site"><Link className="quick-card quick-lilac" to="/explorer"><span className="quick-icon"><Compass size={21}/></span><span><strong>Explore a landing site</strong><small>Choose a spot and look around</small></span><ArrowRight size={17}/></Link><Link className="quick-card quick-peach" to="/missions"><span className="quick-icon"><Orbit size={21}/></span><span><strong>Meet the missions</strong><small>See what NASA is planning next</small></span><ArrowRight size={17}/></Link></section>
  <VirtualMoonTour/>
  <section className="site-section"><div className="section-heading"><div><span className="eyebrow">PICK YOUR PATCH OF MOON</span><h2>Where should we land?</h2></div><Link to="/analysis">Analyze & compare <ArrowRight size={15}/></Link></div><SitePicker/></section>
  <p className="image-credit"><span>☾</span> Moon model: NASA Goddard Space Flight Center, using Lunar Reconnaissance Orbiter imagery and topographic data. <a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noreferrer">Model details ↗</a></p>
</div>}
