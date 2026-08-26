import { describe, expect, it } from 'vitest'

import { createClient } from '../../contractHelpers'
import { runJourneyCases } from '../../contractRunner'
import { cases } from './route.cases'
import { basePathJourney, routeTreeJourney, metadataTreeJourney, nestedJourney } from './route.fixtures'

describe('route contracts', () => {
  runJourneyCases(cases)

  describe('base path', () => {
    it('should mount all routes under the configured basePath', async () => {
      // Arrange
      const client = createClient(basePathJourney, { basePath: '/forms' })

      // Act
      const prefixed = await client.get('/forms/based/start', { session: {} })
      const unprefixed = () => client.get('/based/start', { session: {} })

      // Assert
      expect(prefixed.type).toBe('render')
      await expect(unprefixed()).rejects.toThrow('No route matched GET /based/start')
    })

    it('should prefix redirect resolution with the basePath', async () => {
      // Arrange
      const client = createClient(basePathJourney, { basePath: '/forms' })

      // Act
      const result = await client.post('/forms/based/start', { session: {}, body: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/forms/based/done')
      }
    })

    it('should include the basePath as leading route tree segments', async () => {
      // Arrange
      const client = createClient(basePathJourney, { basePath: '/forms' })

      // Act
      const result = await client.get('/forms/based/start', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const baseNode = result.context.routeTree.find(node => node.segment === 'forms')
        const journeyNode = baseNode?.children.find(node => node.segment === 'based')

        expect(baseNode?.path).toBe('/forms')
        expect(journeyNode?.path).toBe('/forms/based')
        expect(journeyNode?.children.find(node => node.segment === 'start')?.path).toBe('/forms/based/start')
      }
    })
  })

  describe('route tree', () => {
    it('should expose routeTree with resolved paths and active state', async () => {
      // Arrange
      const client = createClient(routeTreeJourney)

      // Act
      const result = await client.get('/route-tree/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const journeyNode = result.context.routeTree.find(node => node.segment === 'route-tree')

        expect(journeyNode).toBeDefined()

        if (journeyNode) {
          expect(journeyNode.path).toBe('/route-tree')
          expect(journeyNode.active).toBe(true)

          const stepOneNode = journeyNode.children.find(node => node.segment === 'step-one')
          const stepTwoNode = journeyNode.children.find(node => node.segment === 'step-two')

          expect(stepOneNode?.active).toBe(true)
          expect(stepOneNode?.path).toBe('/route-tree/step-one')
          expect(stepTwoNode?.active).toBe(false)
          expect(stepTwoNode?.path).toBe('/route-tree/step-two')
        }
      }
    })

    it('should mark route kinds on journey and step nodes', async () => {
      // Arrange
      const client = createClient(routeTreeJourney)

      // Act
      const result = await client.get('/route-tree/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const journeyNode = result.context.routeTree.find(node => node.segment === 'route-tree')
        const stepNode = journeyNode?.children.find(node => node.segment === 'step-one')

        expect(journeyNode?.route?.kind).toBe('journey')
        expect(stepNode?.route?.kind).toBe('step')
      }
    })

    it('should resolve path params on tree nodes and keep the template path', async () => {
      // Arrange
      const client = createClient(metadataTreeJourney)

      // Act
      const result = await client.get('/meta/abc/details', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const journeyNode = result.context.routeTree
          .find(node => node.segment === 'meta')
          ?.children.find(node => node.templatePath === '/meta/:caseId')
        const stepNode = journeyNode?.children.find(node => node.segment === 'details')

        expect(journeyNode?.path).toBe('/meta/abc')
        expect(stepNode?.path).toBe('/meta/abc/details')
        expect(stepNode?.templatePath).toBe('/meta/:caseId/details')
      }
    })

    it('should resolve expression titles and metadata per request', async () => {
      // Arrange
      const client = createClient(metadataTreeJourney)

      // Act
      const result = await client.get('/meta/abc/details', {
        session: { data: { navLabel: 'Case details nav' } },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const journeyNode = result.context.routeTree
          .find(node => node.segment === 'meta')
          ?.children.find(node => node.templatePath === '/meta/:caseId')
        const detailsNode = journeyNode?.children.find(node => node.segment === 'details')
        const plainNode = journeyNode?.children.find(node => node.segment === 'plain')

        expect(journeyNode?.route?.title).toBe('Meta Tree')
        expect(journeyNode?.route?.description).toBe('Journey description')
        expect(journeyNode?.route?.metadata).toEqual({ section: 'testing' })

        expect(detailsNode?.route?.title).toBe('Case abc')
        expect(detailsNode?.route?.description).toBe('Case details')
        expect(detailsNode?.route?.metadata).toEqual({ navLabel: 'Case details nav', hideFromNav: true })

        expect(plainNode?.route?.title).toBe('Plain')
        expect(plainNode?.route?.metadata).toBeUndefined()
      }
    })

    it('should nest child journey nodes and mark the active branch through them', async () => {
      // Arrange
      const client = createClient(nestedJourney)

      // Act
      const result = await client.get('/parent/sub/leaf', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const parentNode = result.context.routeTree.find(node => node.segment === 'parent')
        const childNode = parentNode?.children.find(node => node.segment === 'sub')
        const leafNode = childNode?.children.find(node => node.segment === 'leaf')
        const homeNode = parentNode?.children.find(node => node.segment === 'home')

        expect(parentNode?.active).toBe(true)
        expect(childNode?.route?.kind).toBe('journey')
        expect(childNode?.path).toBe('/parent/sub')
        expect(childNode?.active).toBe(true)
        expect(leafNode?.active).toBe(true)
        expect(leafNode?.path).toBe('/parent/sub/leaf')
        expect(homeNode?.active).toBe(false)
      }
    })
  })
})
