import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import {Panel,Metric} from '../../components/ui/Panel';
import {SitePicker} from '../../components/shared/SitePicker';
import {MockNotice} from '../../components/shared/AsyncState';
export default function Dashboard(){return <><MockNotice/><div className="intro"><span className="eyebrow">EXPLORE · EVALUATE · COMPARE</span><h2>Every landing starts<br/>with a better question.</h2><p>Explore the lunar south pole and build a shared picture of terrain, power and communication trade-offs.</p><Link className="link-button" to="/explorer">Open lunar explorer <ArrowUpRight size={16}/></Link></div><div className="metrics-grid"><Metric label="Region of interest" value="South pole" note="Complex terrain and low-angle sunlight"/><Metric label="Sunlight availability" value="Not evaluated" note="Select a site and request analysis"/><Metric label="Earth visibility" value="Not evaluated" note="Terrain-aware geometry pending"/></div><Panel title="Candidate landing locations"><p className="muted">Fictional coordinates for interface development. Select a location or add up to three to a comparison.</p><SitePicker/></Panel><Panel title="Recent analysis"><p className="muted">No analysis history yet. Open Site Analysis to run a simulated evaluation.</p><Link to="/analysis">Go to analysis →</Link></Panel></>;}

