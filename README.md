# The Atlas — Living World

A 3D campus where 40 specialist residents live across 15 districts. Each resident
has a district, a costume built from an archetype, a daily rhythm, and a
conversation life. The clock runs, the sun moves, people walk to work, meet in
the plaza, and go indoors at night.

Built with Three.js, TypeScript and Vite. No runtime framework.

## Run

```bash
npm install
npm run dev      # http://localhost:5178
npm run build    # typecheck + production bundle in dist/
```

## What is in here

| Path | What it holds |
| --- | --- |
| `src/data/districts.ts` | The 15 districts and 40 residents: titles, bios, expertise, rhythm |
| `src/data/archetypes.ts` | Costume system — garment silhouette plus features (hats, aprons, visors, satchels) |
| `src/data/rhythms.ts` | Four daily routines, as hour-indexed blocks |
| `src/world/campus.ts` | Ring layout, buildings, venue-specific exterior props, plaza |
| `src/world/character.ts` | The character rig and costume assembly |
| `src/world/lighting.ts` | Sun arc and colour grading across the day |
| `src/world/bake.ts` | Merges the static campus into one mesh per material |
| `src/sim/agents.ts` | Movement, schedules, meetings |
| `src/ui/` | Sidebar, dossier, footer controls |

## How the world works

**Layout.** Districts sit on two rings around a central plaza, the five largest
on the inner ring. Each building faces the plaza; residents work on the apron in
front of it.

**Rhythms.** Every resident follows one of four routines (`early`, `standard`,
`late`, `roaming`). On each sim hour the simulation re-reads the block covering
that hour and retargets the resident: to the district bench, the plaza, another
district, or indoors to sleep. Residents inside a building are hidden, so the
campus empties overnight and fills again in the morning.

**Meetings.** Every few seconds two nearby residents are pulled into a
conversation. They walk to the midpoint, turn to face each other, gesture, and
the exchange is written to the activity feed.

**Costumes.** An archetype is a silhouette (`tailored`, `coat`, `robe`,
`casual`, `work`, `athletic`, `uniform`) plus features. Adding a look means
adding an entry to `ARCHETYPES`, not editing the rig.

## Controls

| Input | Effect |
| --- | --- |
| Drag / scroll | Orbit and zoom |
| Click a resident | Open their dossier |
| Space | Pause and resume |
| T | Guided tour |
| Esc | Reset the camera |
| Speed chip | 1× to 8× sim time |

Deep links work: `#/resident/sherlock`, `#/district/intelligence`.

## Performance

The campus shell is static, so every mesh sharing a material is merged at build
time into a single mesh (`src/world/bake.ts`). Geometry and materials are cached
by their parameters, so the whole scene reuses a small set of both.
