import {useEffect,useState} from 'react';
import {Outlet,useLocation} from 'react-router';
import {Moon,Sun} from 'lucide-react';
import {Sidebar,navigation} from '../navigation/Sidebar';
import {WorkflowNav} from '../shared/WorkflowNav';
import {isMockMode} from '../../services/apiClient';

export function AppLayout(){
 const {pathname}=useLocation();
 const [darkMode,setDarkMode]=useState(()=>{try{return localStorage.getItem('moonwalk-theme')==='dark';}catch{return false;}});
 useEffect(()=>{document.body.classList.toggle('dark-mode',darkMode);try{localStorage.setItem('moonwalk-theme',darkMode?'dark':'light');}catch{/* Theme still works without storage. */}},[darkMode]);
 const workflow=['/explorer','/analysis','/comparison'].includes(pathname);
 return <div className="app-shell"><a className="skip-link" href="#page-main">Skip to main content</a><Sidebar/><div className="workspace">
  <header className="topbar"><div className="topbar-heading"><span className="eyebrow">LUNAR FIELD GUIDE</span><h1>{navigation.find(n=>n.path===pathname)?.label??(pathname==='/comparison'?'Compare sites':'Page not found')}</h1></div>
   <div className="topbar-tools"><span className="status">{isMockMode?'Demo analysis':'NASA SPICE geometry'}</span><button className="theme-toggle" type="button" onClick={()=>setDarkMode(value=>!value)} aria-label={darkMode?'Switch to light mode':'Switch to dark mode'} aria-pressed={darkMode}>{darkMode?<Sun size={16}/>:<Moon size={16}/>}<span>{darkMode?'Light':'Dark'}</span></button></div>
  </header>
  <main id="page-main" key={pathname} tabIndex={-1}>{workflow&&<WorkflowNav/>}<Outlet/></main>
  <footer><span>MOONWALK · NASA SPACE APPS</span><span>A lunar field guide. Models inform exploration.</span></footer>
 </div></div>;
}

