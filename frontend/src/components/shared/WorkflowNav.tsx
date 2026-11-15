import {NavLink} from 'react-router';
import {useAppState} from '../../context/AppContext';
export function WorkflowNav(){
 const {selectedSites}=useAppState();
 return <nav className="workflow-nav" aria-label="Scenario workflow">
  <NavLink to="/explorer"><span>01</span> Location & time</NavLink>
  <NavLink to="/analysis"><span>02</span> Understand conditions</NavLink>
  <NavLink to="/comparison"><span>03</span> Compare{selectedSites.length>0?` (${selectedSites.length})`:''}</NavLink>
 </nav>;
}
