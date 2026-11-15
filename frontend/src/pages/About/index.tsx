import {ArrowUpRight,Map,Orbit,RadioTower} from 'lucide-react';
import './about.css';
import {isMockMode} from '../../services/apiClient';

const steps=[
 {title:'Explore',body:'Choose a point on the Moon and explore its terrain.'},
 {title:'Compare',body:'Compare sunlight and Earth visibility across sites.'},
 {title:'Follow',body:'Discover upcoming missions and their destinations.'},
];
const sources=[
 {title:'NASA Moon Trek',body:'Lunar maps and mission planning layers',href:'https://trek.nasa.gov/moon/'},
 {title:'Lunar Reconnaissance Orbiter',body:'Images and data from lunar orbit',href:'https://pds-geosciences.wustl.edu/missions/lro/default.htm'},
 {title:'JPL Horizons',body:'Solar system positions and ephemerides',href:'https://ssd.jpl.nasa.gov/horizons/'},
];
export default function About(){return <div className="about-page">
 <section className="about-hero"><div className="about-hero-copy"><span className="about-kicker">THE MOONWALK PROJECT</span><h2>Explore the Moon.<br/>Plan your mission.</h2><p>Explore lunar terrain, compare landing conditions and follow future missions—all in one place.</p><a className="about-explore-link" href="#about-steps">How it works <ArrowUpRight size={15}/></a></div><figure className="about-hero-image about-full-moon"><img src="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/general/images/2024/05/christmas2015fullmoon.jpg?fit=clip&h=3240&w=3240" alt="High-resolution full-disk view of the Moon created from NASA Lunar Reconnaissance Orbiter imagery." loading="lazy" decoding="async"/><span className="about-image-label">THE MOON · LRO GLOBAL VIEW</span><figcaption>NASA Lunar Reconnaissance Orbiter <a href="https://science.nasa.gov/solar-system/resources/resource-packages/earths-moon-resources/" target="_blank" rel="noreferrer" aria-label="Read NASA's source for this lunar image"><ArrowUpRight size={13}/></a></figcaption></figure></section>
 <section className="about-guide" id="about-steps"><div className="about-guide-heading"><span className="eyebrow">A SIMPLE WORKFLOW</span><h2>Explore. Compare. Discover.</h2></div><div className="about-steps" aria-label="How to use Moonwalk">{steps.map(({title,body},i)=><article key={title}><span className="about-step-number">0{i+1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></section>
 <section className="data-truth"><div className="data-truth-heading"><span className="eyebrow">A NOTE ON THE DATA</span><h2>Real data.<br/>Clear limitations.</h2></div><div className="data-truth-copy"><p>{isMockMode?'Analysis and comparison use labeled example results. The 3D explorer uses live SPICE geometry.':'NASA/JPL SPICE computes Sun and Earth positions for the selected site and time.'} Lunar datasets provide terrain and imagery. Smooth-horizon results exclude local shadows; Earth visibility does not confirm a radio link. Unavailable data is labeled.</p><div className="data-truth-tags"><span><Map size={15}/> Sourced imagery</span><span><Orbit size={15}/> Modeled or demo results</span><span><RadioTower size={15}/> SPICE geometry</span></div></div></section>
 <section className="about-sources" id="about-sources"><div className="section-heading"><div><span className="eyebrow">NASA & JPL REFERENCES</span><h2>Built on lunar data</h2></div></div><div className="about-source-grid">{sources.map(source=><a className="about-source-card" key={source.title} href={source.href} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><small>{source.body}</small></span><ArrowUpRight size={17}/></a>)}</div></section>
 </div>}
