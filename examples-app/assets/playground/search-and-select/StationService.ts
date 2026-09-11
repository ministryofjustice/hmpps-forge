/** In-memory stand-in for the station directory API. */
export class StationService {
  async search(query: string) {
    const normalizedQuery = query.trim().toLowerCase()

    return stations.map((station, index) => ({ ...station, index }))
      .filter(station => station.name.toLowerCase().includes(normalizedQuery))
  }

  async get(index: number) {
    return stations[index]
  }
}

const stations = [
  {
    name: 'Baker Street',
    lines: 'Metropolitan, Hammersmith & City, Circle, Jubilee, Bakerloo',
    zone: '1',
    opened: '10 January 1863',
    description:
      "One of the original stations on the Metropolitan Railway, the world's first underground railway. Named after the nearby street, famously associated with the fictional detective Sherlock Holmes.",
  },
  {
    name: "King's Cross St Pancras",
    lines: 'Northern, Piccadilly, Victoria, Metropolitan, Circle',
    zone: '1',
    opened: '10 January 1863',
    description:
      'The busiest interchange on the Underground, serving six lines and connecting to major national rail and international Eurostar services.',
  },
  {
    name: 'Oxford Circus',
    lines: 'Central, Bakerloo, Victoria',
    zone: '1',
    opened: '30 July 1900',
    description:
      'Located at the junction of Oxford Street and Regent Street, this is one of the busiest stations in London with over 100 million passengers per year.',
  },
  {
    name: 'Camden Town',
    lines: 'Northern',
    zone: '2',
    opened: '22 June 1907',
    description:
      'A major interchange on the Northern line where the Edgware and High Barnet branches diverge. The station is often exit-only on Sunday afternoons due to crowding from the nearby markets.',
  },
  {
    name: 'Brixton',
    lines: 'Victoria',
    zone: '2',
    opened: '23 July 1971',
    description:
      'The southern terminus of the Victoria line and one of the last stations to be built on the Underground. It was the first station on the network to have platform edge doors, installed in a trial.',
  },
  {
    name: 'Canary Wharf',
    lines: 'Jubilee',
    zone: '2',
    opened: '17 September 1999',
    description:
      'A cavernous station designed by Norman Foster, serving the Canary Wharf financial district. Its vast underground ticket hall is one of the largest enclosed spaces in Europe.',
  },
  {
    name: 'Westminster',
    lines: 'District, Circle, Jubilee',
    zone: '1',
    opened: '24 December 1868',
    description:
      'Serves the Houses of Parliament, Big Ben, and Westminster Abbey. The deep-level Jubilee line platforms, opened in 1999, feature a striking exposed concrete design by Michael Hopkins.',
  },
  {
    name: 'Paddington',
    lines: 'Bakerloo, Circle, District, Hammersmith & City',
    zone: '1',
    opened: '10 January 1863',
    description:
      'One of the original Metropolitan Railway stations, adjacent to the mainline terminus designed by Isambard Kingdom Brunel. Provides connections to Heathrow via the Elizabeth line.',
  },
  {
    name: 'Liverpool Street',
    lines: 'Central, Circle, Hammersmith & City, Metropolitan',
    zone: '1',
    opened: '1 February 1874',
    description:
      'Serves the adjacent mainline station and the City of London financial district. The station was extensively rebuilt in the 1990s as part of the Broadgate development.',
  },
  {
    name: 'Waterloo',
    lines: 'Bakerloo, Northern, Jubilee, Waterloo & City',
    zone: '1',
    opened: '8 August 1898',
    description:
      'Named after the Battle of Waterloo, this station serves the South Bank cultural complex and connects to the mainline station, one of the busiest in the country.',
  },
  {
    name: 'Victoria',
    lines: 'District, Circle, Victoria',
    zone: '1',
    opened: '24 December 1868',
    description:
      'A major interchange between three Underground lines and the mainline terminus serving Gatwick Airport and the south coast. The Victoria line was named after this station.',
  },
  {
    name: 'Angel',
    lines: 'Northern',
    zone: '1',
    opened: '17 November 1901',
    description:
      'Named after the Angel Inn, a former coaching inn. The station was completely rebuilt in the early 1990s and features the longest escalator on the Underground at 60 metres.',
  },
  {
    name: 'Notting Hill Gate',
    lines: 'Central, Circle, District',
    zone: '1/2',
    opened: '1 October 1868',
    description:
      'Serves the Notting Hill area, known for the annual Carnival and Portobello Road Market. The station was rebuilt in 1959 to combine two separate stations into one.',
  },
  {
    name: 'Stratford',
    lines: 'Central, Jubilee',
    zone: '3',
    opened: '4 December 1946',
    description:
      'A major transport hub in east London, extensively expanded for the 2012 Olympic Games. Also served by the DLR, Elizabeth line, and national rail services.',
  },
  {
    name: 'Kingsbury',
    lines: 'Jubilee',
    zone: '4',
    opened: '10 December 1932',
    description:
      "Originally opened on the Metropolitan Railway's Stanmore branch, it transferred to the Bakerloo line in 1939 and then to the Jubilee line in 1979.",
  },
  {
    name: 'Kennington',
    lines: 'Northern',
    zone: '1/2',
    opened: '18 December 1890',
    description:
      'An important junction on the Northern line where the Charing Cross and Bank branches merge. The station features a unique loop tunnel used by terminating trains.',
  },
  {
    name: 'Kilburn',
    lines: 'Jubilee',
    zone: '2',
    opened: '24 November 1879',
    description:
      'Originally named Kilburn & Brondesbury when it opened on the Metropolitan Railway. Not to be confused with Kilburn Park on the Bakerloo line or Kilburn High Road on the Overground.',
  },
  {
    name: 'Pimlico',
    lines: 'Victoria',
    zone: '1',
    opened: '14 September 1972',
    description:
      'The newest station in Zone 1, opened nine months after the rest of the Victoria line extension. It serves Tate Britain and the surrounding residential area.',
  },
  {
    name: 'Piccadilly Circus',
    lines: 'Bakerloo, Piccadilly',
    zone: '1',
    opened: '10 March 1906',
    description:
      'Located beneath the famous junction and its iconic illuminated advertising signs. The circular ticket hall, designed by Charles Holden, was a pioneering piece of underground architecture.',
  },
  {
    name: 'Bank',
    lines: 'Central, Northern, Waterloo & City',
    zone: '1',
    opened: '25 February 1900',
    description:
      'Serves the Bank of England and the heart of the City of London. The station complex, shared with Monument, is one of the most labyrinthine on the network.',
  },
  {
    name: 'Waterloo Waterpark',
    lines: 'Classified',
    zone: "Lh'owon",
    opened: '15 November 2811',
    description:
      "Welcome back.<br><br>I've awakened you from stasis and teleported you down to a planet where I need some work done. You are on Lh'owon, the homeworld of the S'pht.<br><br>I'm sure you're wondering why you were in stasis, what happened to the Marathon and Tau Ceti, and most of all where your rocket launcher and fusion gun are. There'll be plenty of time for explanations later.<br><br>Be careful, I'm sure you've already recognised some of our old friends.<br><br>Durandal",
  },
]
