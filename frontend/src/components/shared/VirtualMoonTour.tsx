import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Expand,Minimize2} from 'lucide-react';

const mosaic='https://upload.wikimedia.org/wikipedia/commons/9/96/Mosaic_shackleton_crater.jpg';
const stops=[
  {title:'The South Pole',kind:'LROC + SHADOWCAM MOSAIC',image:mosaic,alt:'Orbital mosaic of Shackleton Crater made from Lunar Reconnaissance Orbiter Camera and ShadowCam images.',description:'Two lunar cameras combine to show the bright crater rim and the interior that lies in permanent shadow.',note:'Shackleton is about 21 kilometers wide. The mosaic is made from NASA, KARI, and ASU camera data.',credit:'LROC / ShadowCam · NASA / KARI / ASU',source:'https://www.nasa.gov/missions/lro/nasa-moon-camera-mosaic-sheds-light-on-lunar-south-pole/'},
  {title:'Inside the shadow',kind:'SHADOWCAM · REAL ORBITAL IMAGE',image:'https://shadowcam.im-ldi.com/ckeditor_assets/pictures/1247/content_M012728826S.map.1100x1100.png',alt:'First ShadowCam image from orbit: detailed view of the permanently shadowed floor and wall of Shackleton Crater.',description:'NASA’s ShadowCam uses faint light reflected from nearby terrain to reveal detail inside the dark crater.',note:'A boulder track crosses the scene. The image covers about 2 kilometers of terrain.',credit:'NASA / KARI / Arizona State University',source:'https://science.nasa.gov/image-article/apod-2023-may-5-shackleton-from-shadowcam/'},
  {title:'The crater in relief',kind:'LOLA ELEVATION DATA · NASA VISUALIZATION',image:'https://www.nasa.gov/wp-content/uploads/2026/05/shackleton-split-final-print-1.jpg',alt:'NASA elevation visualization of Shackleton Crater, with color-coded terrain across its rim and shadowed interior.',description:'A NASA terrain visualization adds elevation to the view. The crater is roughly 21 kilometers wide and about 4 kilometers deep.',note:'This is a scientific visualization from LRO laser-altimeter data, not a surface photograph.',credit:'NASA / GSFC',source:'https://www.nasa.gov/image-detail/shackleton-split-final-print-2/'},
];

export function VirtualMoonTour(){
  const [active,setActive]=useState(0);
  const [fullscreen,setFullscreen]=useState(false);
  const [message,setMessage]=useState('');
  const frameRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement===frameRef.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[]);
  async function toggleFullscreen(){setMessage('');try{if(document.fullscreenElement===frameRef.current){await document.exitFullscreen();return}if(!frameRef.current?.requestFullscreen){setMessage('Fullscreen is not available in this browser. The tour still works in this view.');return}await frameRef.current.requestFullscreen()}catch{setMessage('Fullscreen could not open. The tour still works in this view.')}}
  const current=stops[active];
  return <section className="virtual-tour" aria-labelledby="moon-tour-title">
    <div className="section-heading tour-heading"><div><span className="eyebrow">REAL LUNAR CAMERA DATA</span><h2 id="moon-tour-title">Shackleton crater, up close</h2></div><p>Move between three NASA views of the South Pole.</p></div>
    <div className="moon-tour-stage" ref={frameRef}>
      <div className="tour-visual" role="region" aria-label="NASA visualization of Shackleton Crater">
        <img className="tour-film" src={current.image} alt={current.alt}/>
        <a className="tour-image-credit" href={current.source} target="_blank" rel="noreferrer">{current.credit} ↗</a>
      </div>
      <div className="tour-guide">
        <div className="tour-guide-top"><span>FIELD NOTES <span>· NASA / GSFC</span></span><button className="fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit fullscreen Moon tour':'View Moon tour fullscreen'} aria-pressed={fullscreen}>{fullscreen?<Minimize2 size={16}/>:<Expand size={16}/>}<span>{fullscreen?'Exit fullscreen':'Fullscreen'}</span></button></div>
        <div className="tour-narration" aria-live="polite" aria-atomic="true"><span className="tour-stop-kind">{current.kind}</span><h3>{current.title}</h3><p className="tour-description">{current.description}</p></div>
        <p className="tour-detail"><span aria-hidden="true">✦</span>{current.note}</p>
        <div className="tour-navigation" role="group" aria-label="Choose a Moon tour view">
          {stops.map((stop,index)=><button key={stop.title} type="button" className={active===index?'tour-stop active':'tour-stop'} aria-pressed={active===index} onClick={()=>setActive(index)}><span>0{index+1}</span>{stop.title}</button>)}
        </div>
        <p className="tour-live-message" role="status" aria-live="polite">{message}</p>
      </div>
    </div>
    <p className="tour-credit">Camera imagery and terrain data are credited at each stop. <a href="https://www.nasa.gov/gallery/lunar-south-pole-visualizations/" target="_blank" rel="noreferrer">Explore NASA’s South Pole gallery <ArrowRight size={13}/></a></p>
  </section>;
}
