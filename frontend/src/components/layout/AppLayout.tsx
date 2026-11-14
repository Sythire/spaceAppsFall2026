import {Outlet,useLocation} from 'react-router';
import {Sidebar,navigation} from '../navigation/Sidebar';
import {DateSelector} from '../shared/DateSelector';
import {isMockMode} from '../../services/apiClient';
export function AppLayout(){const {pathname}=useLocation();return <div className="app-shell"><Sidebar/><div className="workspace"><header className="topbar"><div><span className="eyebrow">LUNARSITE / MISSION PLANNING</span><h1>{navigation.find(n=>n.path===pathname)?.label??'Page not found'}</h1></div><div className="topbar-tools"><DateSelector/><span className="status"><i/>{isMockMode?'NASA data not connected':'Service configured · availability unverified'}</span></div></header><main><Outlet/></main><footer>SPACE APPS · LUNAR LANDING SITE NAVIGATOR<span>Frontend foundation / 0.1</span></footer></div></div>;}

