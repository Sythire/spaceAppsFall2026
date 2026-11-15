import {createElement} from 'react';
import {Link} from 'react-router';
import {ArrowRight,Sparkles} from 'lucide-react';
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

  <section className="welcome-hero">
    <div className="welcome-copy"><span className="hello-pill"><Sparkles size={14}/> YOUR LUNAR FIELD GUIDE</span><h2>A place. A date.<br/><em>A view of the Moon.</em></h2><p>Choose a lunar location, understand its daylight and view of Earth, then compare the possibilities.</p><div className="hero-buttons"><Link className="button button-yellow" to="/explorer">Explore landing sites <ArrowRight size={16}/></Link><Link className="hero-secondary" to="/missions">See future missions</Link></div><p className="globe-hint"><span aria-hidden="true">↻</span> Drag to rotate · use arrow keys too</p></div>
    <div className="welcome-art"><div className="moon-orbit" aria-hidden="true"><span/></div><MoonGlobe/><span className="art-caption">NASA LRO DATA · INTERACTIVE 3D</span></div>
  </section>
  <details className="disclosure"><summary>Take a guided tour of the Moon</summary><VirtualMoonTour/></details>
  <details className="disclosure"><summary>Browse the lunar location catalog</summary><section className="site-section"><div className="section-heading"><div><span className="eyebrow">PICK YOUR PATCH OF MOON</span><h2>Where should we land?</h2></div><Link to="/analysis">Analyze & compare <ArrowRight size={15}/></Link></div><SitePicker/></section></details>
  <MockNotice/>
  <p className="image-credit"><span>☾</span> Moon model: NASA Goddard Space Flight Center, using Lunar Reconnaissance Orbiter imagery and topographic data. <a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noreferrer">Model details ↗</a></p>
</div>}
