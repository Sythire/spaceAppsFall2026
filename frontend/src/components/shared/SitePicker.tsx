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
 * dropdown: one dropdown holding a scrolling list of every module. There is a single list of selected
 * modules (max 3): the first selected module is shown in detail, and selecting a second or third turns
 * it into a comparison. There is no separate "analyse" action distinct from the comparison.
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
  <div className="site-card-top"><span className="tag">{kindLabel(site)}</span>{active&&<span className="site-selected-mark">{buttons?'Selected':'Detailed'}</span>}</div>
  <h3>{site.name}</h3>
  {site.status&&<p className="muted">{site.status}</p>}
  {buttons&&site.source&&<p><a href={site.source} target="_blank" rel="noreferrer">Coordinate source ↗</a></p>}
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
 const selected=(s:LunarLocation)=>selectedSites.some(x=>x.id===s.id);
 const blocked=(s:LunarLocation)=>selectedSites.length>=MAX_COMPARE&&!selected(s);
 const primary=selectedSites[0]??null; // the first selected module is the one shown in detail

 /** One unified action: add or remove a module from the selection (max 3). No separate "analyse". */
 const toggle=(s:LunarLocation)=>{if(!selected(s)&&blocked(s))return;state.toggleSite(s);};

 // Keep the detailed/primary `location` in sync with the first selected module, so the single-module
 // analysis panel and every other page that reads `location` follow the one selection.
 useEffect(()=>{if(primary&&primary.id!==location?.id)state.setLocation(primary);else if(!primary&&location)state.toggleSite(location);},[primary,location,state]);

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
  if(e.key==='ArrowDown'){e.preventDefault();setHighlight(h=>Math.max(0,Math.min(h+1,shown.length-1)));}
  else if(e.key==='ArrowUp'){e.preventDefault();setHighlight(h=>Math.max(h-1,0));}
  else if((e.key==='Enter'||e.key==='+')&&shown[highlight]){e.preventDefault();toggle(shown[highlight]);}
  else if(e.key==='Escape'){setOpen(false);}
 };

 return <div className="site-dropdown">
  <div className="site-dropdown-anchor" ref={root}>
   <button type="button" className={`site-dropdown-trigger${open?' is-open':''}`} aria-label="Choose landing sites" aria-controls={open?listId:undefined} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
    <span className="site-dropdown-label">Sites</span>
    <span className="site-dropdown-value">{selectedSites.length===0?'Choose sites…':selectedSites.length===1?primary!.name:`${selectedSites.length} sites selected`}</span>
    <span className="site-dropdown-count">{sites.length} sites</span>
    <ChevronDown size={17} aria-hidden="true"/>
   </button>

   {open&&<div className="site-dropdown-panel">
    <div className="site-dropdown-search">
     <Search size={14} aria-hidden="true"/>
     <input ref={search} type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-label="Search landing sites"
      aria-activedescendant={shown[highlight]?`${listId}-${highlight}`:undefined}
      value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search Apollo, CLPS or a landing site"/>
    </div>
    <p className="site-dropdown-help">Select up to {MAX_COMPARE} sites. The first shows detailed conditions; add another to compare.</p>
    <ul className="site-dropdown-list" role="listbox" id={listId} ref={list} aria-label="Landing sites" aria-multiselectable="true">
     {shown.map((s,i)=>{
      const on=selected(s),off=blocked(s),isPrimary=primary?.id===s.id;
      const ix=on?selectedSites.findIndex(x=>x.id===s.id):-1;
      return <li key={s.id} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={on} aria-disabled={off}
       className={`site-option${i===highlight?' is-highlighted':''}${on?' is-current':''}`}
       onMouseEnter={()=>setHighlight(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>toggle(s)}>
       <div className="site-option-text">
        <span className="site-option-name">{s.name}<span className={`site-row-kind k-${s.kind??'other'}`}>{kindLabel(s,true)}</span></span>
        <span className="site-option-meta">{formatLat(s.latitudeDeg)} · {formatLon(s.longitudeDeg)}{s.status?` · ${s.status}`:''}</span>
       </div>
       <div className="site-option-actions">
        {isPrimary&&<span className="site-option-primary">Detailed</span>}
        <button type="button" tabIndex={-1} className={`site-option-add${on?' is-on':''}`} disabled={off}
         style={on?{'--chip':siteColor(ix)} as CSSProperties:undefined}
         aria-label={on?`Remove ${s.name} from selection (colour ${ix+1})`:`Add ${s.name} to selection`}
         title={off?`Selection is full (${MAX_COMPARE} modules)`:on?'Remove from selection':'Add to selection'}
         onClick={e=>{e.stopPropagation();toggle(s);}}>{on?<Check size={15}/>:<Plus size={15}/>}</button>
       </div>
      </li>;
     })}
     {shown.length===0&&<li className="site-option-empty">No sites match “{query}”.</li>}
    </ul>
   </div>}
  </div>

  {primary&&<div className="site-grid site-dropdown-selected"><SiteCard site={primary} buttons={false}/></div>}

  <div className="site-compare-bar" aria-live="polite">
   {selectedSites.length===0
    ?<span className="muted">{sites.length} landing sites · Apollo and CLPS. Add up to three to compare.</span>
    :<span className="site-compare-group">
      <span className="site-compare-label">{selectedSites.length===1?'Showing in detail:':`Comparing ${selectedSites.length} / ${MAX_COMPARE}:`}</span>
      {selectedSites.map((s,i)=><button key={s.id} type="button" className="site-compare-chip" style={{'--chip':siteColor(i)} as CSSProperties} onClick={()=>state.toggleSite(s)} aria-label={`Remove ${s.name} from selection`}><span className="site-compare-dot" aria-hidden="true"/>{s.name}{i===0&&selectedSites.length>1&&<em className="site-compare-primary"> · detailed</em>}<X size={12} aria-hidden="true"/></button>)}
     </span>}
  </div>
 </div>;
}

export function SitePicker({layout='grid'}:{layout?:Layout}){
 const resource=useAsync(siteService.getSites);
 const {location,selectedSites}=useAppState();
 const [customSite,setCustomSite]=useState(()=>location?.id==='custom'?location:null);
 useEffect(()=>{if(location?.id==='custom')setCustomSite(location);},[location]);
 const sites=[...(resource.data??[])];
 for(const site of [...selectedSites,...(customSite?[customSite]:[])]){
  if(!sites.some(s=>s.id===site.id))sites.push(site);
 }
 return <>
  <AsyncState {...resource} empty={resource.data?.length===0}/>
  {layout==='dropdown'
   ?sites.length>0&&<SiteDropdown sites={sites}/>
   :<div className="site-grid">{sites.map(site=><SiteCard key={site.id} site={site}/>)}</div>}
 </>;
}
