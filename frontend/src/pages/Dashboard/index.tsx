import {createElement} from 'react';
import {Link} from 'react-router';
import {ArrowRight,Compass,Orbit,Sparkles,Rotate3d} from 'lucide-react';
import {MockNotice} from '../../components/shared/AsyncState';
import {VirtualMoonTour} from '../../components/shared/VirtualMoonTour';
import './overview-hero.css';

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
  <section className="welcome-hero overview-hero" aria-labelledby="overview-moon-title">
    <div className="welcome-copy">
      <span className="hello-pill"><Sparkles size={14} aria-hidden/> THE LANDING-SITE CHALLENGE</span>
      <h2 id="overview-moon-title">Meet the Moon.</h2>
      <h3 className="overview-problem">Where you land matters.<br/>So does when.</h3>
      <p className="overview-challenge">Crater shadows limit sunlight. Terrain can block the view of Earth.</p>
      <p className="overview-purpose">We’re building a lunar navigator to compare terrain, solar exposure and Earth visibility—helping teams explore better sites and operating windows.</p>
      <div className="overview-focus" aria-label="Planning considerations"><span>Terrain</span><span>Sunlight</span><span>Earth visibility</span></div>
    </div>
    <div className="welcome-art">
      <div className="moon-orbit" aria-hidden="true"><span/></div>
      <MoonGlobe/>
      <span className="art-caption">NASA LRO · INTERACTIVE MOON</span>
      <div className="moon-interaction-hint" role="note" aria-label="Moon controls">
        <Rotate3d size={22} strokeWidth={1.6} aria-hidden/>
        <div><strong>Drag to rotate</strong><span>Or use the arrow keys</span></div>
      </div>
    </div>
  </section>
  <section className="quick-links" aria-label="Explore the site"><Link className="quick-card quick-lilac" to="/explorer"><span className="quick-icon"><Compass size={21}/></span><span><strong>Explore a landing site</strong><small>Choose a spot and look around</small></span><ArrowRight size={17}/></Link><Link className="quick-card quick-peach" to="/missions"><span className="quick-icon"><Orbit size={21}/></span><span><strong>Meet the missions</strong><small>See what NASA is planning next</small></span><ArrowRight size={17}/></Link></section>
  <VirtualMoonTour/>
  <p className="image-credit"><span>☾</span> Moon model: NASA Goddard Space Flight Center, using Lunar Reconnaissance Orbiter imagery and topographic data. <a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noreferrer">Model details ↗</a></p>
</div>}
