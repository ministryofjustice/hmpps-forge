import type { JourneyContractCase } from '../../contractRunner'
import { redirectTargetJourney, parameterizedJourney } from './route.fixtures'

export const cases: JourneyContractCase[] = [
  {
    description: 'redirect target resolution',
    journey: redirectTargetJourney,
    tests: [
      {
        name: 'should resolve a bare path segment against the journey base path',
        path: '/redir/to-segment',
        post: {},
        redirectTo: '/redir/done',
      },
      {
        name: 'should pass an absolute path through unchanged',
        path: '/redir/to-absolute',
        post: {},
        redirectTo: '/outside/place',
      },
      {
        name: 'should keep the query string on an absolute target',
        path: '/redir/to-query',
        post: {},
        redirectTo: '/outside/place?tab=summary',
      },
      {
        name: 'should redirect to an external URL as-is',
        path: '/redir/to-external',
        post: {},
        redirectTo: 'https://example.com/exit',
      },
      {
        name: 'should resolve a dynamic goto expression from request data',
        path: '/redir/to-dynamic',
        post: {},
        session: { data: { target: '/dynamic/landing' } },
        redirectTo: '/dynamic/landing',
      },
      {
        name: 'should relative-resolve a dynamic goto that yields a bare segment',
        path: '/redir/to-dynamic-relative',
        post: {},
        session: { data: { relativeTarget: 'done' } },
        redirectTo: '/redir/done',
      },
      {
        name: 'should keep the query string and hash on a relative target',
        path: '/redir/to-query-hash',
        post: {},
        redirectTo: '/redir/done?from=form#summary',
      },
      {
        name: 'should resolve a dot-relative target against the current step path',
        path: '/redir/dot-sibling',
        post: {},
        redirectTo: '/redir/done',
      },
      {
        name: 'should resolve a parent-relative target one level up',
        path: '/redir/dot-parent',
        post: {},
        redirectTo: '/done',
      },
    ],
  },
  {
    description: 'parameterized routes',
    journey: parameterizedJourney,
    tests: [
      {
        name: 'should match a parameterized step path and render',
        path: '/cases/abc/start',
        rendered: true,
      },
      {
        name: 'should carry the path param into a relative-segment redirect',
        path: '/cases/abc/start',
        post: {},
        redirectTo: '/cases/abc/next',
      },
      {
        name: 'should substitute params in a route-template redirect target',
        path: '/cases/abc/template',
        post: {},
        redirectTo: '/cases/abc/next',
      },
      {
        name: 'should carry the path param into a reachability redirect from the journey root',
        path: '/cases/abc',
        redirectTo: '/cases/abc/start',
      },
    ],
  },
]
