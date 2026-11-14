import {lazy,Suspense} from 'react';
import {BrowserRouter,Routes,Route,Link} from 'react-router';
import {AppProvider} from './context/AppContext';
import {AppLayout} from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Comparison from './pages/Comparison';
import About from './pages/About';
import Missions from './pages/Missions';
// three.js is large; load the 3D explorer only when its route is opened.
const LunarMap=lazy(()=>import('./pages/LunarMap'));
export default function App(){return <AppProvider><BrowserRouter><Routes><Route element={<AppLayout/>}><Route index element={<Dashboard/>}/><Route path="explorer" element={<Suspense fallback={<p className="muted">Loading 3D explorer…</p>}><LunarMap/></Suspense>}/><Route path="analysis" element={<Analysis/>}/><Route path="comparison" element={<Comparison/>}/><Route path="missions" element={<Missions/>}/><Route path="about" element={<About/>}/><Route path="*" element={<><h2>Page not found</h2><Link to="/">Return to overview</Link></>}/></Route></Routes></BrowserRouter></AppProvider>;}

