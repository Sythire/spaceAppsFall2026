import {BrowserRouter,Routes,Route,Link} from 'react-router';
import {AppProvider} from './context/AppContext';
import {AppLayout} from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import LunarMap from './pages/LunarMap';
import Analysis from './pages/Analysis';
import Comparison from './pages/Comparison';
import About from './pages/About';
export default function App(){return <AppProvider><BrowserRouter><Routes><Route element={<AppLayout/>}><Route index element={<Dashboard/>}/><Route path="explorer" element={<LunarMap/>}/><Route path="analysis" element={<Analysis/>}/><Route path="comparison" element={<Comparison/>}/><Route path="about" element={<About/>}/><Route path="*" element={<><h2>Page not found</h2><Link to="/">Return to overview</Link></>}/></Route></Routes></BrowserRouter></AppProvider>;}

