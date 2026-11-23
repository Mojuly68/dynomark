import type { Gym } from '../types';

// Directory built from the brands' own pages, read Nov 2026:
//   https://touchstoneclimbing.com/locations/  (19 gyms; city only, no addresses or disciplines)
//   https://www.benchmarkclimbing.com/locations (2 gyms; bouldering, address, amenities)
//   https://www.bridgesrockgym.com/             (1 gym; bouldering, address, amenities)
// Where a page does not state disciplines we leave them null and let the climber fill them in.

const TS = 'https://touchstoneclimbing.com/locations/';
const touchstone = (id: string, name: string, city: string): Gym => ({
  id,
  name,
  brand: 'Touchstone',
  city,
  state: 'CA',
  website: TS,
  disciplines: null,
  disciplinesSource: null,
  amenities: [],
});

export const DIRECTORY: Gym[] = [
  touchstone('ts-berkeley-ironworks', 'Berkeley Ironworks', 'Berkeley'),
  touchstone('ts-diablo', 'Diablo Rock Gym', 'Concord'),
  touchstone('ts-dogpatch', 'Dogpatch Boulders', 'San Francisco'),
  touchstone('ts-gwpc', 'Great Western Power Co.', 'Oakland'),
  touchstone('ts-hyperion', 'Hyperion', 'Redwood City'),
  touchstone('ts-mission-cliffs', 'Mission Cliffs', 'San Francisco'),
  touchstone('ts-pacific-pipe', 'Pacific Pipe', 'Oakland'),
  touchstone('ts-sac-pipeworks', 'Sacramento Pipeworks', 'Sacramento'),
  touchstone('ts-team-training', 'Team Training Center', 'Berkeley'),
  touchstone('ts-the-oaks', 'The Oaks', 'Berkeley'),
  touchstone('ts-the-studio', 'The Studio', 'San Jose'),
  touchstone('ts-aisle-19', 'Aisle 19', 'San Francisco'),
  touchstone('ts-class-5', 'Class 5', 'Torrance'),
  touchstone('ts-cliffs-of-id', 'Cliffs of ID', 'Culver City'),
  touchstone('ts-hollywood', 'Hollywood Boulders', 'Los Angeles'),
  touchstone('ts-la-boulders', 'LA Boulders', 'Los Angeles'),
  touchstone('ts-metalmark', 'Metalmark', 'Fresno'),
  touchstone('ts-the-post', 'The Post', 'Pasadena'),
  touchstone('ts-verdigo', 'Verdigo Boulders', 'Burbank'),
  {
    id: 'bm-san-francisco',
    name: 'Benchmark San Francisco',
    brand: 'Benchmark',
    city: 'San Francisco',
    state: 'CA',
    address: '1414 Van Ness Ave (between Pine and Bush), San Francisco, CA',
    website: 'https://www.benchmarkclimbing.com/locations',
    disciplines: ['bouldering'],
    disciplinesSource: 'gym-site',
    amenities: ['Moonboard', 'Campus board', 'Hangboards', 'Fitness area', 'Workspace and lounge', 'Showers', 'ADA bathrooms'],
    description: 'Bouldering, fitness and workspace. Angled terrain from slabs to steep overhangs.',
  },
  {
    id: 'bm-berkeley',
    name: 'Benchmark Berkeley',
    brand: 'Benchmark',
    city: 'Berkeley',
    state: 'CA',
    address: '1607 Shattuck Ave, Berkeley, CA',
    website: 'https://www.benchmarkclimbing.com/locations',
    disciplines: ['bouldering'],
    disciplinesSource: 'gym-site',
    amenities: ['Moonboard', 'Hangboards', 'Campus board', 'Fitness area', 'Workspace', 'Showers', 'Two parking lots', 'Bike storage'],
    description: 'Bouldering, fitness and workspace. Angled terrain from slabs to steep overhangs.',
  },
  {
    id: 'bridges',
    name: 'Bridges Rock Gym',
    brand: 'Bridges',
    city: 'El Cerrito',
    state: 'CA',
    address: '5635 San Diego St., El Cerrito, CA 94530',
    website: 'https://www.bridgesrockgym.com/',
    disciplines: ['bouldering'],
    disciplinesSource: 'gym-site',
    amenities: ['8,000 sq ft of bouldering', '18 ft top-out boulders', 'Yoga classes daily', 'Fitness rig, treadmills, rowers', 'TRX, boxing, HIIT'],
    description: 'Bouldering, yoga and fitness. Fresh boulders three days a week.',
  },
];

export const BRANDS = ['Touchstone', 'Benchmark', 'Bridges'] as const;

export const DISCIPLINE_LABEL: Record<string, string> = {
  bouldering: 'Bouldering',
  'top-rope': 'Top rope',
  lead: 'Lead',
  'auto-belay': 'Auto-belay',
};
