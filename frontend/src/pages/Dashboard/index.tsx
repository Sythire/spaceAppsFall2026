import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import {Panel,Metric} from '../../components/ui/Panel';
import {SitePicker} from '../../components/shared/SitePicker';
import {MockNotice} from '../../components/shared/AsyncState';
import {useAppState} from '../../context/AppContext';
import {isMockMode} from '../../services/apiClient';
export default function Dashboard(){
 const {analysis}=useAppState();
 return <><MockNotice/>
  <div className="intro"><span className="eyebrow">EXPLORE · EVALUATE · COMPARE</span><h2>Every landing starts<br/>with a better question.</h2><p>Explore the lunar south pole and compare lighting and Earth visibility across sites and dates.</p><Link className="link-button" to="/explorer">Open lunar explorer <ArrowUpRight size={16}/></Link></div>
  <div className="metrics-grid"><Metric label="Region of interest" value="South pole" note="Complex terrain and low-angle sunlight"/><Metric label="Sunlight availability" value={analysis?analysis.illumination.sunlightPercent.toFixed(1)+'%':'Not evaluated'} note={analysis?analysis.request.location.name:'Select a site in Site Analysis'}/><Metric label="Earth visibility" value={analysis?analysis.earthVisibilityPercent.toFixed(1)+'%':'Not evaluated'} note={analysis?'Fraction of the analyzed interval':'Select a site in Site Analysis'}/></div>
  <Panel title="Landing-site references"><p className="muted">{isMockMode?'Fictional coordinates for interface development.':'NASA-sourced Apollo locations and a hypothetical south-pole test location.'} Select a location or add up to three to a comparison.</p><SitePicker/></Panel>
  <Panel title="Latest analysis"><p className="muted">{analysis?`${analysis.request.location.name} · ${analysis.request.utc} · ${analysis.mode}`:'Open Site Analysis, select a site and choose a UTC start to calculate lighting and visibility.'}</p><Link to="/analysis">Go to analysis →</Link></Panel>
 </>;
}
