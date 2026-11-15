import {useEffect,useState} from 'react';
import {Link,Outlet,useLocation} from 'react-router';
import {Moon,Sun} from 'lucide-react';
import {Sidebar} from '../navigation/Sidebar';
import {WorkflowNav} from '../shared/WorkflowNav';

export function AppLayout(){
 const {pathname}=useLocation();
 const [darkMode,setDarkMode]=useState(()=>{try{return localStorage.getItem('moonwalk-theme')!=='light';}catch{return true;}});
 useEffect(()=>{document.body.classList.toggle('dark-mode',darkMode);try{localStorage.setItem('moonwalk-theme',darkMode?'dark':'light');}catch{/* Theme remains usable without storage. */}},[darkMode]);
 const workflow=['/explorer','/analysis','/comparison'].includes(pathname);
 return <div className="app-shell"><a className="skip-link" href="#page-main">Skip to main content</a><Sidebar><button className="appearance-control" type="button" onClick={()=>setDarkMode(value=>!value)} aria-label={darkMode?'Switch to light mode':'Switch to dark mode'} aria-pressed={darkMode}>{darkMode?<Sun size={17}/>:<Moon size={17}/>}<span>{darkMode?'Light':'Dark'}</span></button></Sidebar><div className="workspace">
  <main id="page-main" key={pathname} tabIndex={-1}>{workflow&&<WorkflowNav/>}<Outlet/></main>
  <footer><span>Moonwalk <span aria-hidden="true">·</span> NASA Space Apps</span><Link to="/about">About the project ↗</Link></footer>
 </div></div>;
}

