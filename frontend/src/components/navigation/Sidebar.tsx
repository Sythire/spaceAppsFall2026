import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import {NavLink} from 'react-router';
import {LayoutDashboard,Globe,ChartNoAxesCombined,Info,PanelLeftClose,PanelLeftOpen,Orbit} from 'lucide-react';
export const navigation=[{path:'/',label:'Overview',icon:LayoutDashboard},{path:'/explorer',label:'Lunar Explorer',icon:Globe},{path:'/analysis',label:'Site Research',icon:ChartNoAxesCombined},{path:'/missions',label:'Missions & Future',icon:Orbit},{path:'/about',label:'About',icon:Info}];
const MIN_WIDTH=200;
const MAX_WIDTH=360;
function clampWidth(value:number){return Math.min(MAX_WIDTH,Math.max(MIN_WIDTH,value));}
export function Sidebar(){
  const [collapsed,setCollapsed]=useState(false);
  const [width,setWidth]=useState(()=>{
    try{const saved=Number(localStorage.getItem('moonwalk-sidebar-width'));return saved?clampWidth(saved):250;}catch{return 250;}
  });
  const [resizing,setResizing]=useState(false);
  const drag=useRef<{pointerId:number;startX:number;startWidth:number}|null>(null);
  useEffect(()=>{
    if(!resizing){try{localStorage.setItem('moonwalk-sidebar-width',String(width));}catch{/* Resizing also works without browser storage. */}}
  },[width,resizing]);
  function startResize(event:PointerEvent<HTMLDivElement>){
    if(event.button!==0)return;
    drag.current={pointerId:event.pointerId,startX:event.clientX,startWidth:width};
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }
  function moveResize(event:PointerEvent<HTMLDivElement>){
    if(drag.current?.pointerId!==event.pointerId)return;
    setWidth(clampWidth(drag.current.startWidth+event.clientX-drag.current.startX));
  }
  function endResize(event:PointerEvent<HTMLDivElement>){
    if(drag.current?.pointerId!==event.pointerId)return;
    drag.current=null;
    setResizing(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function resizeWithKeyboard(event:KeyboardEvent<HTMLDivElement>){
    const step=event.shiftKey?30:10;
    const next=event.key==='ArrowLeft'?width-step:event.key==='ArrowRight'?width+step:event.key==='Home'?MIN_WIDTH:event.key==='End'?MAX_WIDTH:null;
    if(next===null)return;
    event.preventDefault();setWidth(clampWidth(next));
  }
  return <aside style={{'--sidebar-width':`${width}px`} as CSSProperties} className={'sidebar '+(collapsed?'collapsed ':'')+(resizing?'is-resizing':'')}><div className="brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><circle className="brand-orbit" cx="24" cy="24" r="20"/><path className="brand-moon" d="M34.6 11.4a15.1 15.1 0 1 0 2.1 22.8A16.5 16.5 0 0 1 34.6 11.4Z"/><circle className="brand-crater" cx="18" cy="20" r="2.2"/><circle className="brand-crater" cx="27.5" cy="27" r="1.5"/><path className="brand-trail" d="M11 34c4.3-3.4 7.2-4.3 10.1-4.1"/><path className="brand-boot" d="m11.2 31.6 2.2 1.1-.7 2-2.1-.9zm4.2-2.7 2.2 1.1-.7 2-2.1-.9z"/><path className="brand-star" d="m35 6 1.2 2.7L39 10l-2.8 1.2L35 14l-1.2-2.8L31 10l2.8-1.3z"/></svg></span>{!collapsed&&<span>Moonwalk<small>FIELD GUIDE</small></span>}</div><button className="collapse" aria-label={collapsed?'Expand navigation':'Collapse navigation'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><nav id="main-navigation" aria-label="Main navigation">{navigation.map(({path,label,icon:Icon})=><NavLink key={path} to={path} end={path==='/'} title={label}><Icon size={19}/>{!collapsed&&label}</NavLink>)}</nav>{!collapsed&&<div className="sidebar-footer"><strong>Mission control</strong><span>Your lunar field guide</span></div>}{!collapsed&&<div className="sidebar-resize-handle" role="separator" tabIndex={0} aria-label="Resize navigation" aria-orientation="vertical" aria-controls="main-navigation" aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH} aria-valuenow={width} aria-valuetext={`${width} pixels`} title="Drag to resize · Arrow keys to adjust" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} onLostPointerCapture={endResize} onKeyDown={resizeWithKeyboard}/>}</aside>;
}

