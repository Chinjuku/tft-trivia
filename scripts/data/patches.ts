// Set -> patch to read data from. Mid-sets are separate sets (design §4.1).
// `mutator` picks the entry inside `setData`; old files (no setData) read `sets[number]`.
// Patches are late in each set when data is most settled. Confirmed with scripts/data/probe.ts.
// `status` stays "draft" until the user reviews the data report.
import type { SetSpec } from './normalize'

export const SETS: SetSpec[] = [
  { id: '1', number: 1, name: 'Origins', patch: '9.21' },
  { id: '2', number: 2, name: 'Rise of the Elements', patch: '10.5' },
  { id: '3', number: 3, name: 'Galaxies', patch: '10.11' },
  // 3.5 reused the TFTSet3 mutator; the patch is what separates it from Set 3
  { id: '3.5', number: 3.5, name: 'Return to the Stars', patch: '10.18', mutator: 'TFTSet3' },
  { id: '4', number: 4, name: 'Fates', patch: '10.25', mutator: 'TFTSet4' },
  { id: '4.5', number: 4.5, name: 'Festival of Beasts', patch: '11.8', mutator: 'TFTSet4_Act2' },
  { id: '5', number: 5, name: 'Reckoning', patch: '11.14', mutator: 'TFT_Set5' },
  { id: '5.5', number: 5.5, name: 'Dawn of Heroes', patch: '11.21', mutator: 'TFT_Set5_Stage2' },
  { id: '6', number: 6, name: 'Gizmos & Gadgets', patch: '12.2', mutator: 'TFT_Set6' },
  { id: '6.5', number: 6.5, name: 'Neon Nights', patch: '12.10', mutator: 'TFTSet6_Stage2' },
  { id: '7', number: 7, name: 'Dragonlands', patch: '12.17', mutator: 'TFTSet7' },
  { id: '7.5', number: 7.5, name: 'Uprising', patch: '12.22', mutator: 'TFTSet7_Stage2' },
  { id: '8', number: 8, name: 'Monsters Attack!', patch: '13.5', mutator: 'TFTSet8' },
  { id: '8.5', number: 8.5, name: 'Glitched Out!!', patch: '13.11', mutator: 'TFTSet8_Stage2' },
  { id: '9', number: 9, name: 'Runeterra Reforged', patch: '13.18', mutator: 'TFTSet9' },
  { id: '9.5', number: 9.5, name: 'Horizonbound', patch: '13.22', mutator: 'TFTSet9_Stage2' },
  { id: '10', number: 10, name: 'Remix Rumble', patch: '14.5', mutator: 'TFTSet10' },
  { id: '11', number: 11, name: 'Inkborn Fables', patch: '14.13', mutator: 'TFTSet11' },
  { id: '12', number: 12, name: "Magic n' Mayhem", patch: '14.22', mutator: 'TFTSet12' },
  { id: '13', number: 13, name: 'Into the Arcane', patch: '15.5', mutator: 'TFTSet13' },
  { id: '14', number: 14, name: 'Cyber City', patch: '15.12', mutator: 'TFTSet14' },
  { id: '15', number: 15, name: 'K.O. Coliseum', patch: '15.20', mutator: 'TFTSet15' },
  // 16+ filled in after probing 16.x
]
