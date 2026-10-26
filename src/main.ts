import './styles/app.css';
import { Atlas } from './app';
import { loadResidentModel } from './world/model';

// Residents are clones of one loaded rig, so the campus cannot be built until
// that rig is in memory.
await loadResidentModel();
new Atlas();
