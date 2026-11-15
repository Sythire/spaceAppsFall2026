import {useEffect,useId,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {Check,ChevronDown,Plus,Search,X} from 'lucide-react';
import {siteService} from '../../services/siteService';
import {useAsync} from '../../hooks/useAsync';
import {useAppState} from '../../context/AppContext';
import {AsyncState} from './AsyncState';
import {isMockMode} from '../../services/apiClient';
import {siteColor} from '../../constants/siteColors';
import type {LunarLocation} from '../../types';

/**
 * grid: the original card grid with "Use for analysis" / "Compare +" buttons.
 * dropdown: one dropdown holding a scrolling list of every module. Clicking a module analyses it on its own;
 * "+" adds other modules to the comparison (the analysed module is included automatically).
 */
type Layout='grid'|'dropdown';
const MAX_COMPARE=3;

function kindLabel(site:LunarLocation,short=false){
 if(isMockMode)return short?'SIMULATED':'SIMULATED CANDIDATE';
 switch(site.kind){
  case 'historical':return short?'APOLLO':'NASA HISTORICAL SITE';
  case 'clps-landed':return short?'CLPS · LANDED':'NASA CLPS · LANDED';
  case 'clps-planned':return short?'CLPS · PLANNED':'NASA CLPS · PLANNED TARGET REGION';
  default:return short?'TEST SITE':'HYPOTHETICAL TEST SITE';
 }
}
const formatLat=(d:number)=>`${Math.abs(d).toFixed(2)}° ${d<0?'S':'N'}`;
const formatLon=(d:number)=>`${Math.abs(d).toFixed(2)}° ${d<0?'W':'E'}`;

/** The original site card. `buttons` shows the original "Use for analysis" / "Compare +" row. */
function SiteCard({site,buttons=true}:{site:LunarLocation;buttons?:boolean}){
 const state=useAppState();
 const active=state.location?.id===site.id;
 const comparing=state.selectedSites.some(s=>s.id===site.id);
 return <article className={`panel site-card${active?' is-selected':''}`}>
  <div className="site-card-top"><span className="tag">{kindLabel(site)}</span>{active&&<span className="site-selected-mark">{buttons?'Selected':'Analysing'}</span>}</div>
  <h3>{site.name}</h3>
  {site.status&&<p className="muted">{site.status}</p>}
  {site.source&&<p><a href={site.source} target="_blank" rel="noreferrer">Coordinate source ↗</a></p>}
  <p className="site-coordinates"><span aria-hidden="true">⌖</span>{formatLat(site.latitudeDeg)} <i>·</i> {formatLon(site.longitudeDeg)}</p>
  {buttons&&<div className="button-row">
   <button className={active?'active':''} aria-pressed={active} onClick={()=>state.setLocation(site)}>{active?'Selected':'Use for analysis'}</button>
   <button aria-pressed={comparing} disabled={state.selectedSites.length===MAX_COMPARE&&!comparing} onClick={()=>state.toggleSite(site)}>{comparing?'Remove':'Compare +'}</button>
  </div>}
 </article>;
}

function SiteDropdown({sites}:{sites:LunarLocation[]}){
 const state=useAppState();
 const {location,selectedSites}=state;
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const [highlight,setHighlight]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const search=useRef<HTMLInputElement>(null);
 const list=useRef<HTMLUListElement>(null);
 const listId=useId();

 const q=query.trim().toLowerCase();
 const shown=q?sites.filter(s=>`${s.name} ${s.status??''} ${kindLabel(s)}`.toLowerCase().includes(q)):sites;
 const comparing=(s:LunarLocation)=>selectedSites.some(x=>x.id===s.id);
 const blocked=(s:LunarLocation)=>selectedSites.length>=MAX_COMPARE&&!comparing(s);

 /** Click a module: analyse just that one (the original "Use for analysis"). */
 const analyse=(s:LunarLocation)=>{state.setLocation(s);setOpen(false);setQuery('');};
 /** "+": add/remove a module from the comparison. If nothing is being analysed yet, the first "+" also
  * analyses that module, so one selection already shows its data. When something else is analysed, "+"
  * brings that module into the comparison too, so it reads "analysed module vs the ones you added".
  * toggleSite / setLocation update functionally, so the calls chain. */
 const toggleCompare=(s:LunarLocation)=>{
  if(comparing(s)){state.toggleSite(s);return;}
  if(blocked(s))return;
  if(!location){state.setLocation(s);state.toggleSite(s);return;}
  const bringAnalysed=location.id!==s.id&&!comparing(location)&&selectedSites.length<=MAX_COMPARE-2;
  if(bringAnalysed)state.toggleSite(location);
  state.toggleSite(s);
 };

 useEffect(()=>{
  if(!open)return;
  search.current?.focus();
  const onDown=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',onDown);
  return ()=>document.removeEventListener('pointerdown',onDown);
 },[open]);
 useEffect(()=>{setHighlight(0);},[q]);
 useEffect(()=>{list.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({block:'nearest'});},[highlight,open]);

 const onKey=(e:KeyboardEvent)=>{
  if(e.key==='ArrowDown'){e.preventDefault();setHighlight(h=>Math.min(h+1,shown.length-1));}
  else if(e.key==='ArrowUp'){e.preventDefault();setHighlight(h=>Math.max(h-1,0));}
  else if(e.key==='Enter'&&shown[highlight]){e.preventDefault();analyse(shown[highlight]);}
  else if(e.key==='+'&&shown[highlight]){e.preventDefault();toggleCompare(shown[highlight]);}
  else if(e.key==='Escape'){setOpen(false);}
 };

 return <div className="site-dropdown">
  <div className="site-dropdown-anchor" ref={root}>
   <button type="button" className={`site-dropdown-trigger${open?' is-open':''}`} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
    <span className="site-dropdown-label">Module</span>
    <span className="site-dropdown-value">{location?location.name:'Choose a module to analyse…'}</span>
    <span className="site-dropdown-count">{sites.length} modules</span>
    <ChevronDown size={17} aria-hidden="true"/>
   </button>

   {open&&<div className="site-dropdown-panel">
    <div className="site-dropdown-search">
     <Search size={14} aria-hidden="true"/>
     <input ref={search} type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
      aria-activedescendant={shown[highlight]?`${listId}-${highlight}`:undefined}
      value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search modules (Apollo, CLPS, Athena…)"/>
    </div>
    <p className="site-dropdown-help"><b>Analyse</b> shows one module’s data · <b>+</b> adds it to the comparison ({selectedSites.length} / {MAX_COMPARE})</p>
    <ul className="site-dropdown-list" role="listbox" id={listId} ref={list} aria-label="All modules">
     {shown.map((s,i)=>{
      const on=comparing(s),off=blocked(s),current=location?.id===s.id;
      const compareIx=on?selectedSites.findIndex(x=>x.id===s.id):-1;
      return <li key={s.id} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={current}
       className={`site-option${i===highlight?' is-highlighted':''}${current?' is-current':''}`}
       onMouseEnter={()=>setHighlight(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>analyse(s)}>
       <div className="site-option-text">
        <span className="site-option-name">{s.name}<span className={`site-row-kind k-${s.kind??'other'}`}>{kindLabel(s,true)}</span></span>
        <span className="site-option-meta">{formatLat(s.latitudeDeg)} · {formatLon(s.longitudeDeg)}{s.status?` · ${s.status}`:''}</span>
       </div>
       <div className="site-option-actions">
        <button type="button" tabIndex={-1} className={`site-option-analyse${current?' is-current':''}`} aria-pressed={current}
         aria-label={current?`${s.name} is being analysed`:`Analyse ${s.name}`}
         onClick={e=>{e.stopPropagation();analyse(s);}}>{current?'Analysing':'Analyse'}</button>
        <button type="button" tabIndex={-1} className={`site-option-add${on?' is-on':''}`} disabled={off}
         style={on?{'--chip':siteColor(compareIx)} as CSSProperties:undefined}
         aria-label={on?`Remove ${s.name} from comparison (comparison colour ${compareIx+1})`:`Add ${s.name} to comparison`}
         title={off?`Comparison is full (${MAX_COMPARE} modules)`:on?'Remove from comparison':'Add to comparison'}
         onClick={e=>{e.stopPropagation();toggleCompare(s);}}>{on?<Check size={15}/>:<Plus size={15}/>}</button>
       </div>
      </li>;
     })}
     {shown.length===0&&<li className="site-option-empty">No modules match “{query}”.</li>}
    </ul>
   </div>}
  </div>

  {location&&<div className="site-grid site-dropdown-selected"><SiteCard site={location} buttons={false}/></div>}

  <div className="site-compare-bar" aria-live="polite">
   {location
    ?<span className="site-analysing-pill"><span className="site-analysing-dot" aria-hidden="true"/>Analysing now: <strong>{location.name}</strong></span>
    :<span className="muted">Pick a module to analyse it.</span>}
   {selectedSites.length===0
    ?<span className="muted">Press <b>+</b> on modules in the list to compare them.</span>
    :<span className="site-compare-group">
      <span className="site-compare-label">Comparing {selectedSites.length} / {MAX_COMPARE}{selectedSites.length<2?' · add one more':''}:</span>
      {selectedSites.map((s,i)=><button key={s.id} type="button" className="site-compare-chip" style={{'--chip':siteColor(i)} as CSSProperties} onClick={()=>state.toggleSite(s)} aria-label={`Remove ${s.name} from comparison`}><span className="site-compare-dot" aria-hidden="true"/>{s.name}<X size={12} aria-hidden="true"/></button>)}
     </span>}
  </div>
 </div>;
}

export function SitePicker({layout='grid'}:{layout?:Layout}){
 const resource=useAsync(siteService.getSites);
 const sites=resource.data??[];
 return <>
  <AsyncState {...resource} empty={resource.data?.length===0}/>
  {layout==='dropdown'
   ?sites.length>0&&<SiteDropdown sites={sites}/>
   :<div className="site-grid">{sites.map(site=><SiteCard key={site.id} site={site}/>)}</div>}
 </>;
}
