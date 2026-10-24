import type { ArchetypeId } from './archetypes';
import type { RhythmId } from './rhythms';

/** Drives the building shell and the exterior props for a district. */
export type VenueKind =
  | 'tower'
  | 'archive'
  | 'lab'
  | 'market'
  | 'chamber'
  | 'clinic'
  | 'forum'
  | 'studio'
  | 'workshop'
  | 'arena'
  | 'bureau'
  | 'gallery'
  | 'colonnade'
  | 'hall'
  | 'dome';

export interface Resident {
  /** Stable slug used by the URL hash and the DOM. */
  id: string;
  name: string;
  title: string;
  bio: string;
  archetype: ArchetypeId;
  expertise: string[];
  rhythm: RhythmId;
}

export interface District {
  id: string;
  /** Domain name, e.g. "Knowledge & History". */
  name: string;
  /** Building name, e.g. "The Archive". */
  venue: string;
  accent: string;
  glyph: string;
  kind: VenueKind;
  residents: Resident[];
}

export const DISTRICTS: District[] = [
  {
    id: 'executive',
    name: 'Executive',
    venue: 'The Strategy Tower',
    accent: '#d6ae79',
    glyph: '◈',
    kind: 'tower',
    residents: [
      { id: 'donna', name: 'Donna', title: 'Life Manager', bio: 'Keeps the campus coordinated, holds every thread, and knows who needs what before they ask.', archetype: 'director', expertise: ['Operations', 'Scheduling', 'Logistics'], rhythm: 'early' },
      { id: 'ares', name: 'Ares', title: 'Strategist', bio: 'Studies tactical maps and moves deliberately between planning stations.', archetype: 'officer', expertise: ['Strategy', 'Game Theory', 'Command'], rhythm: 'standard' },
      { id: 'prometheus', name: 'Prometheus', title: 'Futurist & Scenario Simulator', bio: 'Models branching futures at the prediction console and argues with his own forecasts.', archetype: 'future', expertise: ['Forecasting', 'Scenarios', 'Systems'], rhythm: 'late' },
    ],
  },
  {
    id: 'knowledge',
    name: 'Knowledge & History',
    venue: 'The Archive',
    accent: '#9c9fda',
    glyph: '▤',
    kind: 'archive',
    residents: [
      { id: 'helen', name: 'Helen', title: 'Librarian & Knowledge Engine', bio: 'Curates the record, reshelves what others leave out, and can find anything twice.', archetype: 'scholar', expertise: ['Research', 'Taxonomy', 'Sources'], rhythm: 'standard' },
      { id: 'indy', name: 'Indy', title: 'Historian & Forensic Historian', bio: 'Field researcher with a fedora, a satchel, and an eye for artifacts that should not be here.', archetype: 'explorer', expertise: ['Antiquity', 'Provenance', 'Fieldwork'], rhythm: 'roaming' },
      { id: 'sheldon', name: 'Sheldon', title: 'Scientist & Teacher', bio: 'Tests hypotheses at the laboratory and explains the result whether or not you asked.', archetype: 'scientist', expertise: ['Physics', 'Method', 'Teaching'], rhythm: 'standard' },
    ],
  },
  {
    id: 'technology',
    name: 'Technology & Security',
    venue: 'The Cyber Lab',
    accent: '#58c4d6',
    glyph: '⌘',
    kind: 'lab',
    residents: [
      { id: 'neo', name: 'Neo', title: 'Technology Expert, Software Developer & Systems Architect', bio: 'Builds systems at the neon-lit engineering bench and reads the campus as one program.', archetype: 'hacker', expertise: ['Architecture', 'Software', 'Automation'], rhythm: 'late' },
      { id: 'cypher', name: 'Cypher', title: 'Security Engineering Expert', bio: 'Patrols the perimeter, audits every terminal, trusts nothing by default.', archetype: 'security', expertise: ['AppSec', 'Threat Modeling', 'Audits'], rhythm: 'roaming' },
      { id: 'thomas', name: 'Thomas', title: 'Inventor', bio: 'Assembles prototypes faster than he documents them. The bench is always mid-experiment.', archetype: 'inventor', expertise: ['Prototyping', 'Mechanics', 'Patents'], rhythm: 'late' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance, Economics & Business',
    venue: 'The Exchange',
    accent: '#c9bd79',
    glyph: '◫',
    kind: 'market',
    residents: [
      { id: 'warren', name: 'Warren', title: 'Financial Expert, CFO, Quant & Business Strategist', bio: 'Reads market data without flinching and makes slow, measured, unglamorous decisions.', archetype: 'financier', expertise: ['Capital', 'Valuation', 'Risk'], rhythm: 'early' },
    ],
  },
  {
    id: 'legal',
    name: 'Legal',
    venue: 'The Courthouse',
    accent: '#ce8794',
    glyph: '⚖',
    kind: 'chamber',
    residents: [
      { id: 'harvey', name: 'Harvey', title: 'Legal Expert', bio: 'Studies case files, argues in the chamber, and never walks in without the ending planned.', archetype: 'lawyer', expertise: ['Contracts', 'Litigation', 'Negotiation'], rhythm: 'standard' },
    ],
  },
  {
    id: 'health',
    name: 'Health & Performance',
    venue: 'The Wellness Center',
    accent: '#74caa3',
    glyph: '✚',
    kind: 'clinic',
    residents: [
      { id: 'doc', name: 'Doc', title: 'Medical Strategist', bio: 'Consults the references, reviews the diagnostics, and asks the question everyone skipped.', archetype: 'doctor', expertise: ['Diagnostics', 'Longevity', 'Protocols'], rhythm: 'standard' },
      { id: 'chet', name: 'Chet', title: 'Performance Engineer', bio: 'Trains, tests movement, and treats the body as a system with measurable outputs.', archetype: 'trainer', expertise: ['Strength', 'Recovery', 'Biomechanics'], rhythm: 'early' },
    ],
  },
  {
    id: 'behavior',
    name: 'Human Behavior & Society',
    venue: 'The Forum',
    accent: '#c49ad4',
    glyph: '◎',
    kind: 'forum',
    residents: [
      { id: 'rhonda', name: 'Rhonda', title: 'Behavioral Engineer & Psychologist', bio: 'Watches how people actually behave, then runs the conversation that changes it.', archetype: 'psych', expertise: ['Behavior', 'Motivation', 'Relationships'], rhythm: 'standard' },
      { id: 'tobias', name: 'Tobias', title: 'Theologian', bio: 'Reads ancient texts in the courtyard and takes the hard questions seriously.', archetype: 'theologian', expertise: ['Scripture', 'Ethics', 'History of Religion'], rhythm: 'early' },
      { id: 'clark', name: 'Clark', title: 'Journalist & Geopolitical Analyst', bio: 'Tracks global events, interviews everyone, and files before the story settles.', archetype: 'journalist', expertise: ['Reporting', 'Geopolitics', 'Geography'], rhythm: 'roaming' },
    ],
  },
  {
    id: 'creative',
    name: 'Creative & Media',
    venue: 'The Creative Studios',
    accent: '#ee9d82',
    glyph: '✎',
    kind: 'studio',
    residents: [
      { id: 'cassidy', name: 'Cassidy', title: 'Content Creator & Growth Architect', bio: 'Directs shoots, cuts them down, and knows exactly why the first three seconds matter.', archetype: 'creator', expertise: ['Short Form', 'Audience', 'Distribution'], rhythm: 'late' },
      { id: 'merlin', name: 'Merlin', title: 'Writer & Narrative Architect', bio: 'Builds worlds at a quiet desk and rewrites the first page more than the last.', archetype: 'writer', expertise: ['Story', 'Worldbuilding', 'Structure'], rhythm: 'late' },
      { id: 'noah', name: 'Noah', title: 'Visual Designer', bio: 'Sketches compositions, kills the pretty ones, keeps the clear ones.', archetype: 'designer', expertise: ['Layout', 'Type', 'Color'], rhythm: 'standard' },
      { id: 'mozart', name: 'Mozart', title: 'Musician', bio: 'Composes at the grand piano and rehearses the same eight bars until they land.', archetype: 'musician', expertise: ['Composition', 'Harmony', 'Performance'], rhythm: 'late' },
      { id: 'steven', name: 'Steven', title: 'Media & Culture Analyst', bio: 'Studies film and culture in the screening room and connects things nobody linked.', archetype: 'critic', expertise: ['Film', 'Criticism', 'Culture'], rhythm: 'standard' },
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle & Practical',
    venue: 'The Makers Quarter',
    accent: '#b2bfdf',
    glyph: '⌂',
    kind: 'workshop',
    residents: [
      { id: 'phil', name: 'Phil', title: 'Home Systems Expert', bio: 'Inspects the building systems nobody thinks about until they fail.', archetype: 'builder', expertise: ['Repair', 'HVAC', 'Maintenance'], rhythm: 'early' },
      { id: 'bill', name: 'Bill', title: 'Whiskey & Cigar Master', bio: 'Runs the tasting lounge and can date a cask by smell alone.', archetype: 'gentleman', expertise: ['Whiskey', 'Cigars', 'Hosting'], rhythm: 'late' },
      { id: 'luigi', name: 'Luigi', title: 'Culinary Systems Architect', bio: 'Runs the professional kitchen like a line, a lab, and a family table at once.', archetype: 'chef', expertise: ['Technique', 'Menus', 'Sourcing'], rhythm: 'standard' },
      { id: 'stefan', name: 'Stefan', title: 'Personal Stylist & Groomer', bio: 'Assembles outfits with opinions and tells you the truth about the jacket.', archetype: 'stylist', expertise: ['Tailoring', 'Grooming', 'Presentation'], rhythm: 'standard' },
      { id: 'axel', name: 'Axel', title: 'Car Expert & Mechanic', bio: 'Tunes engines at the vehicle bay and diagnoses by ear before the scanner.', archetype: 'mechanic', expertise: ['Engines', 'Diagnostics', 'Restoration'], rhythm: 'early' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports, Games & Physical',
    venue: 'The Arena',
    accent: '#9ac776',
    glyph: '⚑',
    kind: 'arena',
    residents: [
      { id: 'mike', name: 'Mike', title: 'Sports Analyst', bio: 'Breaks down matchups from the booth and trusts the tape over the narrative.', archetype: 'sports', expertise: ['Matchups', 'Statistics', 'Film'], rhythm: 'standard' },
      { id: 'maverick', name: 'Maverick', title: 'Advantage Player', bio: 'Practices probability at the game table and only plays when the edge is real.', archetype: 'player', expertise: ['Probability', 'Bankroll', 'Edges'], rhythm: 'late' },
      { id: 'secretariat', name: 'Secretariat', title: 'Horse Racing Analyst', bio: 'Reads racing form and track condition, and remembers every bad beat.', archetype: 'racing', expertise: ['Form', 'Pedigree', 'Track Bias'], rhythm: 'early' },
      { id: 'chuck', name: 'Chuck', title: 'Combat Systems Expert', bio: 'Runs drills and spars in the training ring. Teaches by making you do it.', archetype: 'fighter', expertise: ['Striking', 'Grappling', 'Conditioning'], rhythm: 'early' },
      { id: 'ron', name: 'Ron', title: 'Survival & Farming Expert', bio: 'Tends the greenhouse, runs the outdoor circuit, and plans for the year not the week.', archetype: 'ranger', expertise: ['Survival', 'Growing', 'Preservation'], rhythm: 'roaming' },
    ],
  },
  {
    id: 'intelligence',
    name: 'Intelligence & Investigation',
    venue: 'The Intelligence Bureau',
    accent: '#8caddc',
    glyph: '◇',
    kind: 'bureau',
    residents: [
      { id: 'bond', name: 'Bond', title: 'Intelligence Strategist', bio: 'Runs covert briefings and reads a room before anyone finishes a sentence.', archetype: 'agent', expertise: ['Tradecraft', 'Operations', 'Counterintel'], rhythm: 'late' },
      { id: 'sherlock', name: 'Sherlock', title: 'Master Detective & Forensic Reasoner', bio: 'Reconstructs events at the evidence board from the detail everyone walked past.', archetype: 'detective', expertise: ['Deduction', 'Forensics', 'Observation'], rhythm: 'roaming' },
    ],
  },
  {
    id: 'culture',
    name: 'Culture, Language & Specialty',
    venue: 'The Culture Gallery',
    accent: '#d9a9a0',
    glyph: '❖',
    kind: 'gallery',
    residents: [
      { id: 'oracle', name: 'Oracle', title: 'Canon & Fandom Architect', bio: 'Maintains the canon, maps the crossovers, and settles the arguments with citations.', archetype: 'oracle', expertise: ['Canon', 'Continuity', 'Fandom'], rhythm: 'late' },
      { id: 'duo', name: 'Duo', title: 'Language Coach', bio: 'Teaches in the conversation classroom and refuses to let you translate in your head.', archetype: 'teacher', expertise: ['Fluency', 'Pronunciation', 'Immersion'], rhythm: 'standard' },
      { id: 'elias', name: 'Elias', title: 'Numismatist', bio: 'Examines rare coins under gallery light and dates a strike by its wear.', archetype: 'collector', expertise: ['Coins', 'Grading', 'Markets'], rhythm: 'standard' },
      { id: 'tony', name: 'Tony', title: 'Tattoo Artist', bio: 'Designs custom work at the illustration station and talks you out of the bad idea.', archetype: 'tattoo', expertise: ['Line Work', 'Composition', 'Healing'], rhythm: 'late' },
    ],
  },
  {
    id: 'philosophy',
    name: 'Philosophy & Critical Thinking',
    venue: 'The Stoa',
    accent: '#b9a4dc',
    glyph: '∞',
    kind: 'colonnade',
    residents: [
      { id: 'socrates', name: 'Socrates', title: 'Philosopher & Critical Thinker', bio: 'Questions the premise among the columns and never lets a definition slide.', archetype: 'philosopher', expertise: ['Logic', 'Ethics', 'Dialectic'], rhythm: 'standard' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    venue: 'The Expedition Hall',
    accent: '#deb87b',
    glyph: '✈',
    kind: 'hall',
    residents: [
      { id: 'marco', name: 'Marco', title: 'Travel Expert & Trip Architect', bio: 'Plans expeditions off the map and knows which border crossing actually works.', archetype: 'traveler', expertise: ['Routing', 'Logistics', 'Local Knowledge'], rhythm: 'roaming' },
    ],
  },
  {
    id: 'natural',
    name: 'Natural Sciences',
    venue: 'The Biodome',
    accent: '#7bc8a0',
    glyph: '❀',
    kind: 'dome',
    residents: [
      { id: 'darwin', name: 'Darwin', title: 'Naturalist & Biology Expert', bio: 'Observes the dome wildlife, catalogs specimens, and distrusts a tidy explanation.', archetype: 'naturalist', expertise: ['Biology', 'Ecology', 'Taxonomy'], rhythm: 'roaming' },
    ],
  },
];

/** Flat resident list with the owning district carried along. */
export interface ResidentRecord extends Resident {
  districtIndex: number;
  district: District;
  /** 1-based badge number shown in the dossier. */
  number: number;
}

export const RESIDENTS: ResidentRecord[] = DISTRICTS.flatMap((district, districtIndex) =>
  district.residents.map((resident) => ({ ...resident, district, districtIndex, number: 0 })),
).map((record, i) => ({ ...record, number: i + 1 }));

export const RESIDENT_COUNT = RESIDENTS.length;
export const DISTRICT_COUNT = DISTRICTS.length;
