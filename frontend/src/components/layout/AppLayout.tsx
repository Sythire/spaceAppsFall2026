import {Outlet,useLocation} from 'react-router';
import {Sidebar,navigation} from '../navigation/Sidebar';
import {DateSelector} from '../shared/DateSelector';
import {isMockMode} from '../../services/apiClient';
export function AppLayout(){const {pathname}=useLocation();return <div className="app-shell"><Sidebar/><div className="workspace"><header className="topbar"><div><span className="eyebrow">LUNARSITE / MISSION PLANNING</span><h1>{navigation.find(n=>n.path===pathname)?.label??'Page not found'}</h1></div><div className="topbar-tools"><DateSelector/><span className="status"><i/>{isMockMode?'Analysis: demo fixtures':'Analysis: SPICE service'}</span></div></header><main><Outlet/></main><footer>SPACE APPS · LUNAR LANDING SITE NAVIGATOR<span>Smooth-horizon model / 0.2</span></footer></div></div>;}

