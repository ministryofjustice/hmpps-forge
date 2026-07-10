import { EffectRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { GuideDeps } from '../../effects'
import type { PatternEffectContext } from './context.type'

/**
 * Shared effects used by every pattern demo. Committed answers are persisted
 * through the injected FormDataStore (Redis-backed). Drafts live in the
 * express session under `session.patternDrafts[patternCode]` so they remain
 * isolated from committed state.
 */
export const patternEffectRegistry = new EffectRegistry<GuideDeps>()

export const PatternEffects = {
  /** Copies previously stored answers for this pattern into the form context on access. */
  LoadAnswers: patternEffectRegistry.register(
    'LoadAnswers',
    (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
      const sessionId = context.getSession()?.id

      if (!sessionId) {
        return
      }

      const stored = await deps.formDataStore.get(sessionId, patternCode)

      if (!stored) {
        return
      }

      for (const [code, value] of Object.entries(stored)) {
        if (!context.hasAnswer(code)) {
          context.setAnswer(code, value)
        }
      }
    },
  ),

  /** Copies previously stored draft answers for this pattern into the form context on access. */
  LoadDraftAnswers: patternEffectRegistry.register(
    'LoadDraftAnswers',
    () => (context: PatternEffectContext, patternCode: string) => {
      const stored = context.getSession()?.patternDrafts?.[patternCode]

      if (!stored) {
        return
      }

      for (const [code, value] of Object.entries(stored)) {
        if (!context.hasAnswer(code)) {
          context.setAnswer(code, value)
        }
      }
    },
  ),

  /** Persists the current answers into the session under the pattern's code. */
  SaveAnswers: patternEffectRegistry.register(
    'SaveAnswers',
    (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
      const sessionId = context.getSession()?.id

      if (!sessionId) {
        return
      }

      const fieldsToClear = context.getFieldsToClear()

      for (const field of fieldsToClear) {
        context.clearAnswer(field)
      }

      await deps.formDataStore.set(sessionId, patternCode, context.getAllAnswers())
    },
  ),

  /** Persists the current answers into the session as a draft, kept separately from committed answers. */
  SaveDraftAnswers: patternEffectRegistry.register(
    'SaveDraftAnswers',
    () => (context: PatternEffectContext, patternCode: string) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      if (!session.patternDrafts) {
        session.patternDrafts = {}
      }

      session.patternDrafts[patternCode] = {
        ...session.patternDrafts[patternCode],
        ...context.getAllAnswers(),
      }
    },
  ),

  /** Records in the session whether this pattern has been submitted. */
  SaveSubmitStateToSession: patternEffectRegistry.register(
    'SaveSubmitStateToSession',
    () => (context: PatternEffectContext, patternCode: string, submitted: boolean) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      if (!session.patternSubmitted) {
        session.patternSubmitted = {}
      }

      session.patternSubmitted[patternCode] = submitted
    },
  ),

  /** Clears stored answers for this pattern (used after confirmation / reset). */
  ClearAnswers: patternEffectRegistry.register(
    'ClearAnswers',
    (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
      const sessionId = context.getSession()?.id

      if (!sessionId) {
        return
      }

      await deps.formDataStore.delete(sessionId, patternCode)

      for (const key of Object.keys(context.getAllAnswers())) {
        context.clearAnswer(key)
      }
    },
  ),

  /** Clears draft answers for this pattern (used after committing drafts to the store). */
  ClearDraftAnswers: patternEffectRegistry.register('ClearDraftAnswers', () => {
    return (context: PatternEffectContext, patternCode: string) => {
      const session = context.getSession()

      if (session?.patternDrafts) {
        delete session.patternDrafts[patternCode]
      }

      for (const key of Object.keys(context.getAllAnswers())) {
        context.clearAnswer(key)
      }
    }
  }),

  /** Writes a fixed set of example answers into the session and form context, for demos that need a pre-populated starting state. */
  SeedAnswers: patternEffectRegistry.register(
    'SeedAnswers',
    (deps: GuideDeps) =>
      async (
        context: PatternEffectContext,
        patternCode: string,
        answers: Record<string, unknown>,
      ) => {
        const sessionId = context.getSession()?.id

        if (sessionId) {
          await deps.formDataStore.set(sessionId, patternCode, answers)
        }

        Object.entries(answers).forEach(([code, value]) => context.setAnswer(code, value))
      },
  ),

  /** Writes a fixed set of example answers into the session draft namespace and form context, for demos that need a pre-populated in-progress state. */
  SeedDraftAnswers: patternEffectRegistry.register(
    'SeedDraftAnswers',
    () =>
      (context: PatternEffectContext, patternCode: string, answers: Record<string, unknown>) => {
        const session = context.getSession()

        if (session) {
          if (!session.patternDrafts) {
            session.patternDrafts = {}
          }

          session.patternDrafts[patternCode] = {
            ...session.patternDrafts[patternCode],
            ...answers,
          }
        }

        for (const [code, value] of Object.entries(answers)) {
          context.setAnswer(code, value)
        }
      },
  ),

  /** Bundles temporary field answers into an object and appends it to a collection array. Clears the temporary fields afterwards. */
  AddItemToCollection: patternEffectRegistry.register(
    'AddItemToCollection',
    () => (context: PatternEffectContext, collectionCode: string, fieldCodes: string[]) => {
      const item: Record<string, unknown> = {}

      for (const code of fieldCodes) {
        const value = context.getAnswer(code)

        if (value !== undefined) {
          item[code] = value
        }
      }

      const collection = (context.getAnswer(collectionCode) ?? []) as unknown[]
      context.setAnswer(collectionCode, [...collection, item])

      for (const code of fieldCodes) {
        context.setAnswer(code, undefined)
      }
    },
  ),

  /** Removes an item from a collection array by its index, read from the 'remove' query parameter. */
  RemoveItemFromCollection: patternEffectRegistry.register(
    'RemoveItemFromCollection',
    () => (context: PatternEffectContext, collectionCode: string) => {
      const indexStr = context.getQueryParam('remove')

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(String(indexStr), 10)
      const collection = (context.getAnswer(collectionCode) ?? []) as unknown[]

      if (index >= 0 && index < collection.length) {
        const updated = [...collection]
        updated.splice(index, 1)
        context.setAnswer(collectionCode, updated)
      }
    },
  ),

  /** Reads the ':index' route parameter, extracts the item at that position from the collection, and sets each field as Data for display on a confirmation page. */
  LoadItemForDelete: patternEffectRegistry.register(
    'LoadItemForDelete',
    () => (context: PatternEffectContext, collectionCode: string, fieldCodes: string[]) => {
      const indexStr = context.getRequestParam('index')

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(indexStr, 10)
      const collection = (context.getAnswer(collectionCode) ?? []) as Record<string, unknown>[]

      if (Number.isNaN(index) || index < 0 || index >= collection.length) {
        return
      }

      const item = collection[index]

      for (const code of fieldCodes) {
        if (item[code] !== undefined) {
          context.setData(code, item[code])
        }
      }
    },
  ),

  /** Reads the ':index' route parameter and removes the item at that position from the collection. */
  DeleteItemFromCollection: patternEffectRegistry.register(
    'DeleteItemFromCollection',
    () => (context: PatternEffectContext, collectionCode: string) => {
      const indexStr = context.getRequestParam('index')

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(indexStr, 10)
      const collection = (context.getAnswer(collectionCode) ?? []) as unknown[]

      if (Number.isNaN(index) || index < 0 || index >= collection.length) {
        return
      }

      const updated = [...collection]
      updated.splice(index, 1)
      context.setAnswer(collectionCode, updated)
    },
  ),

  /** Sets a single answer value in the form context. Useful for status tracking or computed values that aren't form fields. */
  SetAnswer: patternEffectRegistry.register(
    'SetAnswer',
    () => (context: PatternEffectContext, code: string, value: unknown) => {
      context.setAnswer(code, value)
    },
  ),

  /** Reads the ':index' route parameter, extracts the item at that position from the collection, sets each field as an answer, and stores the edit index in the session. */
  LoadItemForEdit: patternEffectRegistry.register(
    'LoadItemForEdit',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const indexStr = context.getRequestParam('index')

        if (indexStr === undefined) {
          return
        }

        const index = parseInt(indexStr, 10)
        const collection = (context.getAnswer(collectionCode) ?? []) as Record<string, unknown>[]

        if (Number.isNaN(index) || index < 0 || index >= collection.length) {
          return
        }

        const item = collection[index]

        for (const code of fieldCodes) {
          if (item[code] !== undefined) {
            context.setAnswer(code, item[code])
          }
        }

        const session = context.getSession()

        if (session) {
          if (!session.patternDrafts) {
            session.patternDrafts = {}
          }

          if (!session.patternDrafts[patternCode]) {
            session.patternDrafts[patternCode] = {}
          }

          session.patternDrafts[patternCode].editingIndex = index
        }
      },
  ),

  /** Loads a repeating collection from the session, sets it as Data for the iterator, and restores indexed field answers. */
  InitializeRepeatingFieldsets: patternEffectRegistry.register(
    'InitializeRepeatingFieldsets',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const stored = context.getSession()?.patternDrafts?.[patternCode]
        const collection = (stored?.[collectionCode] ?? []) as Record<string, unknown>[]

        if (collection.length === 0) {
          return
        }

        context.setData(collectionCode, collection)

        collection.forEach((item, index) => {
          for (const code of fieldCodes) {
            context.setAnswer(`${code}_${index}`, (item[code] as string) ?? '')
          }
        })
      },
  ),

  /** Saves current indexed field values to the session collection, appends an empty item, and restores answers with new indices. */
  AddRepeatingItem: patternEffectRegistry.register(
    'AddRepeatingItem',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const session = context.getSession()

        if (!session) {
          return
        }

        if (!session.patternDrafts) {
          session.patternDrafts = {}
        }

        if (!session.patternDrafts[patternCode]) {
          session.patternDrafts[patternCode] = {}
        }

        const stored = session.patternDrafts[patternCode]
        const collection = (stored[collectionCode] ??
          context.getData(collectionCode) ??
          []) as Record<string, unknown>[]

        const updated = collection.map((item, index) => {
          const merged = { ...item }

          for (const code of fieldCodes) {
            merged[code] = context.getAnswer(`${code}_${index}`) ?? item[code]
          }

          return merged
        })

        updated.push(Object.fromEntries(fieldCodes.map(code => [code, ''])))
        stored[collectionCode] = updated

        context.setData(collectionCode, updated)

        updated.forEach((item, index) => {
          for (const code of fieldCodes) {
            context.setAnswer(`${code}_${index}`, (item[code] as string) ?? '')
          }
        })
      },
  ),

  /** Saves current indexed field values, removes the item whose index matches the POST action value, and re-indexes answers. */
  RemoveRepeatingItem: patternEffectRegistry.register(
    'RemoveRepeatingItem',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const session = context.getSession()

        if (!session?.patternDrafts?.[patternCode]) {
          return
        }

        const stored = session.patternDrafts[patternCode]
        const collection = (stored[collectionCode] ??
          context.getData(collectionCode) ??
          []) as Record<string, unknown>[]

        const actionValue = context.getPostData<string>('action')
        const indexStr = actionValue?.replace('remove_', '')
        const index = parseInt(indexStr, 10)

        if (Number.isNaN(index) || index < 0 || index >= collection.length) {
          return
        }

        let updated = collection.map((item, i) => {
          const merged = { ...item }

          for (const code of fieldCodes) {
            merged[code] = context.getAnswer(`${code}_${i}`) ?? item[code]
          }

          return merged
        })

        updated = [...updated.slice(0, index), ...updated.slice(index + 1)]

        stored[collectionCode] = updated

        context.setData(collectionCode, updated)

        updated.forEach((item, i) => {
          for (const code of fieldCodes) {
            context.setAnswer(`${code}_${i}`, (item[code] as string) ?? '')
          }
        })
      },
  ),

  /** Reads current indexed field values into the session collection for persistence across requests. */
  SaveRepeatingItems: patternEffectRegistry.register(
    'SaveRepeatingItems',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const session = context.getSession()

        if (!session) {
          return
        }

        if (!session.patternDrafts) {
          session.patternDrafts = {}
        }

        if (!session.patternDrafts[patternCode]) {
          session.patternDrafts[patternCode] = {}
        }

        const stored = session.patternDrafts[patternCode]
        const collection = (stored[collectionCode] ??
          context.getData(collectionCode) ??
          []) as Record<string, unknown>[]

        stored[collectionCode] = collection.map((item, index) => {
          const merged = { ...item }

          for (const code of fieldCodes) {
            merged[code] = context.getAnswer(`${code}_${index}`) ?? item[code]
          }

          return merged
        })
      },
  ),

  /** Reads the postcode answer, calls the address lookup API, and sets the address field answers with the result. */
  LookupAddress: patternEffectRegistry.register(
    'LookupAddress',
    (deps: GuideDeps) => async (context: PatternEffectContext) => {
      const postcode = context.getAnswer('postcode') as string | undefined

      if (!postcode) {
        return
      }

      const address = await deps.mocksApi.lookupAddress(postcode)

      context.setAnswer('addressLine1', address.line1)
      context.setAnswer('addressLine2', address.line2)
      context.setAnswer('addressTown', address.town)
      context.setAnswer('addressCounty', address.county)
      context.setAnswer('addressPostcode', address.postcode)
    },
  ),

  /** Generates 6 unique lottery numbers (1-59, sorted) and a bonus ball, then sets them as Data values for blocks to display. */
  DrawLotteryNumbers: patternEffectRegistry.register(
    'DrawLotteryNumbers',
    (deps: GuideDeps) => async (context: PatternEffectContext) => {
      const draw = await deps.mocksApi.getLotteryBalls()

      draw.balls.forEach((n, i) => context.setData(`ball${i + 1}`, String(n)))
      context.setData('bonusBall', String(draw.bonusBall))
      context.setData('drawDate', draw.drawDate)
    },
  ),

  /** Sets session.demoUser with the given name and role. Used by the auth-role pattern demo. */
  SimulateLogin: patternEffectRegistry.register(
    'SimulateLogin',
    () => (context: PatternEffectContext, name: string, role: string) => {
      const session = context.getSession()

      if (session) {
        session.demoUser = { name, role }
      }
    },
  ),

  /** Clears session.demoUser. Used by the auth-role pattern demo. */
  SimulateLogout: patternEffectRegistry.register(
    'SimulateLogout',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()

      if (session) {
        delete session.demoUser
      }
    },
  ),

  /** Reads the stored edit index from the session, bundles the current field answers into an object, and replaces the item at that index in the collection. Clears the stored edit index afterwards. */
  EditItemInCollection: patternEffectRegistry.register(
    'EditItemInCollection',
    () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const session = context.getSession()
        const editingIndex = session?.patternDrafts?.[patternCode]?.editingIndex

        if (editingIndex === undefined) {
          return
        }

        const index = Number(editingIndex)
        const collection = (context.getAnswer(collectionCode) ?? []) as Record<string, unknown>[]

        if (index < 0 || index >= collection.length) {
          return
        }

        const item: Record<string, unknown> = {}

        for (const code of fieldCodes) {
          const value = context.getAnswer(code)

          if (value !== undefined) {
            item[code] = value
          }
        }

        const updated = [...collection]
        updated[index] = item
        context.setAnswer(collectionCode, updated)

        for (const code of fieldCodes) {
          context.setAnswer(code, undefined)
        }

        if (session?.patternDrafts?.[patternCode]) {
          delete session.patternDrafts[patternCode].editingIndex
        }
      },
  ),

  /** Reads the searchQuery answer, filters a hardcoded set of London Underground stations by name, and sets the matching results as Data. */
  SearchStations: patternEffectRegistry.register(
    'SearchStations',
    () => (context: PatternEffectContext) => {
      const query = (context.getAnswer('searchQuery') as string | undefined)?.trim().toLowerCase()

      if (!query) {
        context.setData('searchResults', [])

        return
      }

      const allStations = [
        {
          index: 0,
          name: 'Baker Street',
          lines: 'Metropolitan, Hammersmith & City, Circle, Jubilee, Bakerloo',
          zone: '1',
        },
        {
          index: 1,
          name: "King's Cross St Pancras",
          lines: 'Northern, Piccadilly, Victoria, Metropolitan, Circle',
          zone: '1',
        },
        { index: 2, name: 'Oxford Circus', lines: 'Central, Bakerloo, Victoria', zone: '1' },
        { index: 3, name: 'Camden Town', lines: 'Northern', zone: '2' },
        { index: 4, name: 'Brixton', lines: 'Victoria', zone: '2' },
        { index: 5, name: 'Canary Wharf', lines: 'Jubilee', zone: '2' },
        { index: 6, name: 'Westminster', lines: 'District, Circle, Jubilee', zone: '1' },
        {
          index: 7,
          name: 'Paddington',
          lines: 'Bakerloo, Circle, District, Hammersmith & City',
          zone: '1',
        },
        {
          index: 8,
          name: 'Liverpool Street',
          lines: 'Central, Circle, Hammersmith & City, Metropolitan',
          zone: '1',
        },
        {
          index: 9,
          name: 'Waterloo',
          lines: 'Bakerloo, Northern, Jubilee, Waterloo & City',
          zone: '1',
        },
        { index: 10, name: 'Victoria', lines: 'District, Circle, Victoria', zone: '1' },
        { index: 11, name: 'Angel', lines: 'Northern', zone: '1' },
        { index: 12, name: 'Notting Hill Gate', lines: 'Central, Circle, District', zone: '1/2' },
        { index: 13, name: 'Stratford', lines: 'Central, Jubilee', zone: '3' },
        { index: 14, name: 'Kingsbury', lines: 'Jubilee', zone: '4' },
        { index: 15, name: 'Kennington', lines: 'Northern', zone: '1/2' },
        { index: 16, name: 'Kilburn', lines: 'Jubilee', zone: '2' },
        { index: 17, name: 'Pimlico', lines: 'Victoria', zone: '1' },
        { index: 18, name: 'Piccadilly Circus', lines: 'Bakerloo, Piccadilly', zone: '1' },
        { index: 19, name: 'Bank', lines: 'Central, Northern, Waterloo & City', zone: '1' },
        { index: 20, name: 'Waterloo Waterpark', lines: 'Classified', zone: "Lh'owon" },
      ]

      const results = allStations
        .filter(s => s.name.toLowerCase().includes(query))
        .map(s => ({ ...s, href: `station/${s.index}` }))

      context.setData('searchResults', results)
      context.setData('hasSearched', 'true')
    },
  ),

  /** Reads the :index route parameter and loads the corresponding station's fields into Data. */
  LoadStation: patternEffectRegistry.register(
    'LoadStation',
    () => (context: PatternEffectContext) => {
      const indexStr = context.getRequestParam('index')

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(indexStr, 10)

      const allStations = [
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

      if (index >= 0 && index < allStations.length) {
        const station = allStations[index]
        context.setData('stationName', station.name)
        context.setData('stationLines', station.lines)
        context.setData('stationZone', station.zone)
        context.setData('stationOpened', station.opened)
        context.setData('stationDescription', station.description)
        context.setData('stationPage', String(Math.floor(index / 5) + 1))
      }
    },
  ),

  /** Reads the ?page query parameter, slices the station list into pages, and sets pagination Data. */
  LoadStationPage: patternEffectRegistry.register(
    'LoadStationPage',
    () => (context: PatternEffectContext) => {
      const pageParam = context.getQueryParam('page')
      const pageSize = 5

      const allStations = [
        {
          index: 0,
          name: 'Baker Street',
          lines: 'Metropolitan, Hammersmith & City, Circle, Jubilee, Bakerloo',
          zone: '1',
        },
        {
          index: 1,
          name: "King's Cross St Pancras",
          lines: 'Northern, Piccadilly, Victoria, Metropolitan, Circle',
          zone: '1',
        },
        { index: 2, name: 'Oxford Circus', lines: 'Central, Bakerloo, Victoria', zone: '1' },
        { index: 3, name: 'Camden Town', lines: 'Northern', zone: '2' },
        { index: 4, name: 'Brixton', lines: 'Victoria', zone: '2' },
        { index: 5, name: 'Canary Wharf', lines: 'Jubilee', zone: '2' },
        { index: 6, name: 'Westminster', lines: 'District, Circle, Jubilee', zone: '1' },
        {
          index: 7,
          name: 'Paddington',
          lines: 'Bakerloo, Circle, District, Hammersmith & City',
          zone: '1',
        },
        {
          index: 8,
          name: 'Liverpool Street',
          lines: 'Central, Circle, Hammersmith & City, Metropolitan',
          zone: '1',
        },
        {
          index: 9,
          name: 'Waterloo',
          lines: 'Bakerloo, Northern, Jubilee, Waterloo & City',
          zone: '1',
        },
        { index: 10, name: 'Victoria', lines: 'District, Circle, Victoria', zone: '1' },
        { index: 11, name: 'Angel', lines: 'Northern', zone: '1' },
        { index: 12, name: 'Notting Hill Gate', lines: 'Central, Circle, District', zone: '1/2' },
        { index: 13, name: 'Stratford', lines: 'Central, Jubilee', zone: '3' },
        { index: 14, name: 'Kingsbury', lines: 'Jubilee', zone: '4' },
        { index: 15, name: 'Kennington', lines: 'Northern', zone: '1/2' },
        { index: 16, name: 'Kilburn', lines: 'Jubilee', zone: '2' },
        { index: 17, name: 'Pimlico', lines: 'Victoria', zone: '1' },
        { index: 18, name: 'Piccadilly Circus', lines: 'Bakerloo, Piccadilly', zone: '1' },
        { index: 19, name: 'Bank', lines: 'Central, Northern, Waterloo & City', zone: '1' },
      ]

      const totalPages = Math.ceil(allStations.length / pageSize)
      const page = Math.min(Math.max(1, parseInt(String(pageParam ?? '1'), 10) || 1), totalPages)
      const start = (page - 1) * pageSize
      const items = allStations.slice(start, start + pageSize)

      context.setData(
        'stations',
        items.map(s => ({ ...s, href: `detail/${s.index}` })),
      )
      context.setData('currentPage', page)
      context.setData('pages', Array(totalPages).fill(0))
    },
  ),

  /** Loads case overview data and pre-computed derived values for the inline functions pattern demo. */
  LoadCaseOverview: patternEffectRegistry.register(
    'LoadCaseOverview',
    () => (context: PatternEffectContext) => {
      context.setData('case', caseOverviewData)

      const { goals } = caseOverviewData
      const achieved = goals.filter(g => g.status === 'ACHIEVED').length

      context.setData('goalsAchieved', achieved)
      context.setData('goalsTotal', goals.length)

      const { attended, missed } = caseOverviewData.compliance
      const total = attended + missed
      const rate = total > 0 ? Math.round((attended / total) * 100) : 0

      context.setData('complianceRate', rate)
    },
  ),

  /** Loads blog posts from the session and sets them as Data for the posts list. */
  LoadBlogPosts: patternEffectRegistry.register(
    'LoadBlogPosts',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()
      const posts = session?.blogPosts ?? []

      context.setData('posts', posts)

      if (posts.length > 0) {
        context.setData('postCount', posts.length)
      }
    },
  ),

  /** Reads the title and body answers, creates a new blog post, and appends it to the session. */
  SaveBlogPost: patternEffectRegistry.register(
    'SaveBlogPost',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      const title = context.getAnswer('postTitle') as string | undefined
      const body = context.getAnswer('postBody') as string | undefined

      if (!title?.trim() || !body?.trim()) {
        return
      }

      if (!session.blogPosts) {
        session.blogPosts = []
      }

      session.blogPosts.unshift({
        title: title.trim(),
        body: body.trim(),
        date: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      })

      context.setAnswer('postTitle', undefined)
      context.setAnswer('postBody', undefined)
    },
  ),

  /** Loads plan goals from the session (or seeds defaults) and sets them as Data for the collection-validation pattern demo. */
  LoadPlanGoals: patternEffectRegistry.register(
    'LoadPlanGoals',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()
      const stored = session?.patternDrafts?.['collection-validation']?.goals as
        | typeof planGoals
        | undefined
      const goals = stored ?? planGoals

      context.setData('goals', goals)
      context.setData('activeGoalCount', goals.filter(g => g.status === 'ACTIVE').length)
      context.setData('totalGoalCount', goals.length)
    },
  ),

  /** Filters active goals from the session and sets them as Data('activeGoals') for the manage-plan step. */
  InitializePlanActions: patternEffectRegistry.register(
    'InitializePlanActions',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()
      const stored = session?.patternDrafts?.['collection-validation']?.goals as
        | typeof planGoals
        | undefined
      const goals = stored ?? planGoals
      const activeGoals = goals.filter(g => g.status === 'ACTIVE')

      context.setData('activeGoals', activeGoals)

      activeGoals.forEach((goal, index) => {
        if (goal.actions.length > 0 && !context.hasAnswer(`action_${index}`)) {
          context.setAnswer(`action_${index}`, goal.actions.join(', '))
        }
      })
    },
  ),

  /** Reads indexed action answers, adds non-empty values to the corresponding active goal, and persists the updated goals in the session. */
  SavePlanActions: patternEffectRegistry.register(
    'SavePlanActions',
    () => (context: PatternEffectContext) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      if (!session.patternDrafts) {
        session.patternDrafts = {}
      }

      if (!session.patternDrafts['collection-validation']) {
        session.patternDrafts['collection-validation'] = {}
      }

      const stored =
        (session.patternDrafts['collection-validation'].goals as typeof planGoals | undefined) ??
        planGoals.map(g => ({ ...g, actions: [...g.actions] }))

      let activeIndex = 0

      const updated = stored.map(goal => {
        if (goal.status !== 'ACTIVE') {
          return goal
        }

        const action = context.getAnswer(`action_${activeIndex}`) as string | undefined
        context.setAnswer(`action_${activeIndex}`, undefined)
        activeIndex += 1

        if (action?.trim()) {
          const actions = action
            .split(',')
            .map(a => a.trim())
            .filter(Boolean)

          return { ...goal, actions }
        }

        return goal
      })

      session.patternDrafts['collection-validation'].goals = updated
    },
  ),
}

const planGoals = [
  {
    title: 'Improve English skills',
    status: 'ACTIVE',
    actions: ['Attend weekly literacy class', 'Complete practice exercises'],
  },
  {
    title: 'Find stable housing',
    status: 'ACTIVE',
    actions: [],
  },
  {
    title: 'Build employment skills',
    status: 'ACTIVE',
    actions: [],
  },
  {
    title: 'Develop support network',
    status: 'FUTURE',
    actions: [],
  },
]

const caseOverviewData = {
  name: { firstName: 'Sam', lastName: 'Jones' },
  crn: 'X123456',
  tier: 'A1',
  status: 'ACTIVE',
  riskScores: {
    overall: 'HIGH',
    selfHarm: 'LOW',
    publicProtection: 'VERY_HIGH',
    knownAdult: 'MEDIUM',
    children: 'LOW',
    staff: 'LOW',
  },
  sentence: {
    type: 'Community Order',
    startDate: '15 January 2025',
    endDate: '14 January 2027',
    requirements: ['40 hours unpaid work', 'Rehabilitation Activity Requirement'],
  },
  goals: [
    { title: 'Find stable accommodation', status: 'ACHIEVED' },
    { title: 'Enrol in education programme', status: 'IN_PROGRESS' },
    { title: 'Attend substance misuse sessions', status: 'IN_PROGRESS' },
    { title: 'Complete unpaid work hours', status: 'NOT_STARTED' },
    { title: 'Secure part-time employment', status: 'NOT_STARTED' },
  ],
  compliance: {
    attended: 8,
    missed: 1,
    acceptableAbsences: 1,
    warningLetters: 0,
  },
}
