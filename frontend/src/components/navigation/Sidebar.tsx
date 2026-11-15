import {NavLink} from 'react-router';
import type {ReactNode} from 'react';
export const navigation=[
 {path:'/',label:'Overview'},
 {path:'/explorer',label:'Explorer'},
 {path:'/analysis',label:'Analysis'},
 {path:'/comparison',label:'Compare'},
 {path:'/missions',label:'Missions'},
 {path:'/about',label:'About'},
];
export function Sidebar({children}:{children?:ReactNode}){
 return <header className="sidebar">
  <NavLink className="brand" to="/" aria-label="Moonwalk home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="1"/><path d="M16 3.5a12.5 12.5 0 0 1 0 25Z" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="var(--fg-bg)"/></svg></span><span>moonwalk</span></NavLink>
  <nav aria-label="Main navigation">{navigation.map(({path,label})=><NavLink key={path} to={path} end={path==='/'}>{label}</NavLink>)}</nav>
  {children}
 </header>;
}

