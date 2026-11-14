import {BrowserRouter,Routes,Route,Link,Navigate} from 'react-router';
import {AppProvider} from './context/AppContext';
import {AppLayout} from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import LunarMap from './pages/LunarMap';
import Analysis from './pages/Analysis';
import About from './pages/About';
import Missions from './pages/Missions';
export default function App(){return <AppProvider><BrowserRouter><Routes><Route element={<AppLayout/>}><Route index element={<Dashboard/>}/><Route path="explorer" element={<LunarMap/>}/><Route path="analysis" element={<Analysis/>}/><Route path="comparison" element={<Navigate to="/analysis" replace/>}/><Route path="missions" element={<Missions/>}/><Route path="about" element={<About/>}/><Route path="*" element={<><h2>Page not found</h2><Link to="/">Return to overview</Link></>}/></Route></Routes></BrowserRouter></AppProvider>;}

