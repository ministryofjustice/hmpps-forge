interface AddressResult {
  line1: string
  line2: string
  town: string
  county: string
  postcode: string
}

const mockAddresses: Record<string, AddressResult> = {
  SW1A1AA: {
    line1: 'Buckingham Palace',
    line2: 'The Mall',
    town: 'London',
    county: 'Greater London',
    postcode: 'SW1A 1AA',
  },
  SW1A2AA: {
    line1: 'House of Commons',
    line2: 'Parliament Square',
    town: 'London',
    county: 'Greater London',
    postcode: 'SW1A 2AA',
  },
  LS12BJ: {
    line1: '2 Lisbon Street',
    line2: '',
    town: 'Leeds',
    county: 'West Yorkshire',
    postcode: 'LS1 2BJ',
  },
}

const fallbackAddress: AddressResult = {
  line1: '10 Imaginary Lane',
  line2: '',
  town: 'Exampton',
  county: 'Testshire',
  postcode: 'EX1 2AB',
}

/** Local stand-in for an external address lookup API. */
export class AddressLookup {
  async lookupAddress(postcode: string): Promise<AddressResult> {
    const normalised = postcode.replace(/\s/g, '').toUpperCase()

    return mockAddresses[normalised] ?? { ...fallbackAddress, postcode: postcode.toUpperCase() }
  }
}
