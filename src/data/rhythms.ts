/**
 * Daily routines. Each resident follows one rhythm; the simulation reads the
 * block covering the current sim hour and routes them accordingly.
 */

export type Activity = 'rest' | 'work' | 'commons' | 'wander' | 'social';

export interface RhythmBlock {
  /** Sim hour the block starts, 0-23. Blocks are ordered and wrap at midnight. */
  from: number;
  activity: Activity;
  /** Shown in the dossier as what the resident is doing right now. */
  note: string;
}

export type RhythmId = 'early' | 'standard' | 'late' | 'roaming';

export const RHYTHMS: Record<RhythmId, RhythmBlock[]> = {
  early: [
    { from: 0, activity: 'rest', note: 'Asleep in quarters' },
    { from: 5, activity: 'work', note: 'First shift, before the campus wakes' },
    { from: 9, activity: 'commons', note: 'Coffee at the Commons fountain' },
    { from: 10, activity: 'work', note: 'Deep work at the district bench' },
    { from: 13, activity: 'social', note: 'Comparing notes with a neighbour' },
    { from: 15, activity: 'work', note: 'Afternoon block' },
    { from: 19, activity: 'commons', note: 'Winding down on the plaza' },
    { from: 21, activity: 'rest', note: 'Off the clock' },
  ],
  standard: [
    { from: 0, activity: 'rest', note: 'Asleep in quarters' },
    { from: 7, activity: 'commons', note: 'Morning pass through the Commons' },
    { from: 9, activity: 'work', note: 'At the district workstation' },
    { from: 12, activity: 'commons', note: 'Midday break at the fountain' },
    { from: 13, activity: 'work', note: 'Afternoon block' },
    { from: 16, activity: 'wander', note: 'Visiting another district' },
    { from: 18, activity: 'social', note: 'Trading findings with a colleague' },
    { from: 20, activity: 'commons', note: 'Evening on the plaza' },
    { from: 23, activity: 'rest', note: 'Off the clock' },
  ],
  late: [
    { from: 0, activity: 'work', note: 'Working the quiet hours' },
    { from: 3, activity: 'rest', note: 'Asleep in quarters' },
    { from: 11, activity: 'commons', note: 'Late start at the fountain' },
    { from: 13, activity: 'work', note: 'At the district workstation' },
    { from: 17, activity: 'wander', note: 'Walking the campus' },
    { from: 19, activity: 'social', note: 'Long conversation, no agenda' },
    { from: 21, activity: 'work', note: 'Night session' },
  ],
  roaming: [
    { from: 0, activity: 'rest', note: 'Asleep in quarters' },
    { from: 6, activity: 'wander', note: 'Out on the perimeter' },
    { from: 9, activity: 'work', note: 'Back at the district' },
    { from: 11, activity: 'wander', note: 'Field circuit across the campus' },
    { from: 14, activity: 'commons', note: 'Reporting in at the Commons' },
    { from: 15, activity: 'wander', note: 'Second circuit' },
    { from: 18, activity: 'social', note: 'Debrief with whoever is nearby' },
    { from: 20, activity: 'work', note: 'Logging the day' },
    { from: 22, activity: 'rest', note: 'Off the clock' },
  ],
};

/** The block governing a given sim hour. */
export function blockAt(rhythm: RhythmId, hour: number): RhythmBlock {
  const blocks = RHYTHMS[rhythm];
  let current = blocks[blocks.length - 1];
  for (const block of blocks) {
    if (hour >= block.from) current = block;
  }
  return current;
}
