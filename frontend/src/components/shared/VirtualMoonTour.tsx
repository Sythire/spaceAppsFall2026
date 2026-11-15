import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Expand,Minimize2,Pause,Play} from 'lucide-react';

const mosaic='https://upload.wikimedia.org/wikipedia/commons/9/96/Mosaic_shackleton_crater.jpg';
const stops=[
  {title:'Crater overview',kind:'LROC + SHADOWCAM',image:mosaic,alt:'Orbital mosaic of Shackleton Crater made from Lunar Reconnaissance Orbiter Camera and ShadowCam images.',description:'Two cameras reveal Shackleton’s sunlit rim and shadowed interior.',credit:'LROC / ShadowCam · NASA / KARI / ASU',source:'https://www.nasa.gov/missions/lro/nasa-moon-camera-mosaic-sheds-light-on-lunar-south-pole/'},
  {title:'Inside the shadow',kind:'SHADOWCAM IMAGE',image:'https://shadowcam.im-ldi.com/ckeditor_assets/pictures/1247/content_M012728826S.map.1100x1100.png',alt:'First ShadowCam image from orbit: detailed view of the permanently shadowed floor and wall of Shackleton Crater.',description:'Reflected light reveals details inside the dark crater.',credit:'NASA / KARI / Arizona State University',source:'https://science.nasa.gov/image-article/apod-2023-may-5-shackleton-from-shadowcam/'},
  {title:'Terrain elevation',kind:'LOLA ELEVATION MODEL',image:'https://www.nasa.gov/wp-content/uploads/2026/05/shackleton-split-final-print-1.jpg',alt:'NASA elevation visualization of Shackleton Crater, with color-coded terrain across its rim and shadowed interior.',description:'Color shows the crater’s elevation. This is a terrain model, not a photograph.',credit:'NASA / GSFC',source:'https://www.nasa.gov/image-detail/shackleton-split-final-print-2/'},
];

export function VirtualMoonTour(){
  const [active,setActive]=useState(0);
  const [playing,setPlaying]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hovered,setHovered]=useState(false);
  const [visible,setVisible]=useState(!document.hidden);
  const [inView,setInView]=useState(false);
  const sectionRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const sync=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',sync);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{if(media.matches)setPlaying(false);};
    media.addEventListener('change',reduce);
    const observer=new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??false),{threshold:0.2});
    if(sectionRef.current)observer.observe(sectionRef.current);
    return()=>{document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',reduce);observer.disconnect();};
  },[]);
  useEffect(()=>{
    if(!playing||hovered||!visible||!inView)return;
    const timer=window.setInterval(()=>setActive(index=>(index+1)%stops.length),6000);
    return()=>window.clearInterval(timer);
  },[playing,hovered,visible,inView]);

  const [fullscreen,setFullscreen]=useState(false);
  const [message,setMessage]=useState('');
  const frameRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement===frameRef.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[]);
  async function toggleFullscreen(){setMessage('');try{if(document.fullscreenElement===frameRef.current){await document.exitFullscreen();return}if(!frameRef.current?.requestFullscreen){setMessage('Fullscreen is not available in this browser. The tour still works in this view.');return}await frameRef.current.requestFullscreen()}catch{setMessage('Fullscreen could not open. The tour still works in this view.')}}
  const current=stops[active];
  return <section className="virtual-tour tour-slideshow" ref={sectionRef} aria-labelledby="moon-tour-title" aria-roledescription="carousel" onFocusCapture={event=>{if(!(event.target as HTMLElement).closest("[data-playback]"))setPlaying(false);}}>
    <div className="section-heading tour-heading"><div><h2 id="moon-tour-title">Lunar Gallery</h2></div></div>
    <div className="moon-tour-stage" ref={frameRef}>
      <div className="tour-visual" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
        <div className="tour-carousel-track" style={{transform:`translateX(-${active*100}%)`}}>
          {stops.map((stop,index)=><figure className="tour-slide" key={stop.title} aria-hidden={active!==index} aria-roledescription="slide" aria-label={`${index+1} of ${stops.length}`}>
            <img className="tour-film" src={stop.image} alt={stop.alt}/>
            <a className="tour-image-credit" href={stop.source} target="_blank" rel="noreferrer" tabIndex={active===index?0:-1}>{stop.credit} ↗</a>
          </figure>)}
        </div>
      </div>
      <div className="tour-guide">
        <div className="tour-guide-top"><span>View {active+1} of {stops.length}</span><button className="fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit fullscreen Moon tour':'View Moon tour fullscreen'} aria-pressed={fullscreen}>{fullscreen?<Minimize2 size={16}/>:<Expand size={16}/>}<span>{fullscreen?'Exit fullscreen':'Fullscreen'}</span></button></div>
        <div className="tour-narration" aria-live={playing?'off':'polite'} aria-atomic="true"><span className="tour-stop-kind">{current.kind}</span><h3>{current.title}</h3><p className="tour-description">{current.description}</p></div>
        <div className="tour-navigation" role="group" aria-label="Choose a Moon tour view">
          {stops.map((stop,index)=><button key={stop.title} type="button" className={active===index?'tour-stop active':'tour-stop'} aria-pressed={active===index} onClick={()=>{setActive(index);setPlaying(false);}}><span>0{index+1}</span>{stop.title}</button>)}
        </div>
        <button className="tour-playback" type="button" data-playback onClick={()=>setPlaying(value=>!value)} aria-label={playing?'Pause slideshow':'Play slideshow'}>
          {playing?<Pause size={15} aria-hidden/>:<Play size={15} aria-hidden/>}{playing?'Pause slideshow':'Play slideshow'}
        </button>
        <p className="tour-live-message" role="status" aria-live="polite">{message}</p>
      </div>
    </div>
    <div className="tour-gallery-action"><a className="tour-gallery-button" href="https://www.nasa.gov/gallery/lunar-south-pole-visualizations/" target="_blank" rel="noreferrer">Explore NASA’s South Pole gallery <ArrowRight size={16} aria-hidden/></a></div>
  </section>;
}
