import {
  journey,
  step,
  access,
  submit,
  redirect,
  tieBreaker,
  validation,
  Data,
  Post,
  Condition,
  Self,
  type JourneyReachability,
} from '../../../../src/authoring'
import { Effects } from '../../contractHelpers'
import { TextField, StaticText } from '../../testComponents'

/**
 * The canonical three-step chain: `a` is the entry, `b` requires a valid
 * `fieldA`, and `c` requires `fieldB` to equal `valid-b`. The journeys below
 * differ only in journey-level reachability config.
 */
function chainJourney(code: string, reachability?: JourneyReachability) {
  return journey({
    code,
    path: `/${code}`,
    title: `Chain ${code}`,
    ...(reachability === undefined ? {} : { reachability }),
    onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers(code)] })],
    steps: [
      step({
        code: 'a',
        path: '/a',
        title: 'A',
        reachability: { entryWhen: true },
        blocks: [
          TextField({
            code: 'fieldA',
            validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
          }),
        ],
        onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'b' })] } })],
      }),
      step({
        code: 'b',
        path: '/b',
        title: 'B',
        blocks: [
          TextField({
            code: 'fieldB',
            validWhen: [
              validation({ condition: Self().match(Condition.Equals('valid-b')), message: 'Must be valid-b' }),
            ],
          }),
        ],
        onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'c' })] } })],
      }),
      step({ code: 'c', path: '/c', title: 'C', blocks: [StaticText({ text: 'End' })] }),
    ],
  })
}

export const forwardChainJourney = chainJourney('forward')

export const resumeChainJourney = chainJourney('resume', { resumeWhen: true })

export const frontierRedirectJourney = chainJourney('frontier', { unreachableRedirect: 'frontier' })

export const dynamicResumeJourney = chainJourney('dyn-resume', {
  resumeWhen: Data('resumeEnabled').match(Condition.Equals(true)),
})

/**
 * Two sections: a -> b is the first-visit path, c -> d -> e is a review path
 * whose entry opens when `reviewMode` is true. Resume anchors on the active
 * entry whose path has the deepest progress, so the answered review section
 * pulls the frontier past the blocker at b.
 */
export const anchoredResumeJourney = journey({
  code: 'anchor-resume',
  path: '/anchor-resume',
  title: 'Anchored resume',
  reachability: { resumeWhen: true },
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('anchor-resume')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'b' })] } })],
    }),
    step({
      code: 'b',
      path: '/b',
      title: 'B',
      blocks: [
        TextField({
          code: 'fieldB',
          validWhen: [validation({ condition: Self().match(Condition.Equals('valid-b')), message: 'Must be valid-b' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'c' })] } })],
    }),
    step({
      code: 'c',
      path: '/c',
      title: 'C',
      reachability: { entryWhen: Data('reviewMode').match(Condition.Equals(true)) },
      blocks: [
        TextField({
          code: 'fieldC',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'd' })] } })],
    }),
    step({
      code: 'd',
      path: '/d',
      title: 'D',
      blocks: [
        TextField({
          code: 'fieldD',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'e' })] } })],
    }),
    step({ code: 'e', path: '/e', title: 'E', blocks: [StaticText({ text: 'End' })] }),
  ],
})

/**
 * The forward redirect to `b` is guarded by a Post() condition the analyzer
 * cannot evaluate outside a submission, so forward analysis must
 * over-approximate: `b` stays reachable on any request once `a` is valid.
 */
export const requestTimeGuardJourney = journey({
  code: 'req-time-guard',
  path: '/req-time-guard',
  title: 'Request-time guard',
  onAccess: [access({ effects: [Effects.LoadAnswers('req-time-guard')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ when: Post('confirm').match(Condition.Equals('yes')), goto: 'b' })],
          },
        }),
      ],
    }),
    step({ code: 'b', path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
  ],
})

/**
 * The submit hook carries a stable data-backed `when`, which forward
 * analysis CAN evaluate on any request, so it gates the hook's targets.
 */
export const stableWhenGuardJourney = journey({
  code: 'stable-guard',
  path: '/stable-guard',
  title: 'Stable when guard',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('stable-guard')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          when: Data('allowB').match(Condition.Equals(true)),
          validate: true,
          onValid: { next: [redirect({ goto: 'b' })] },
        }),
      ],
    }),
    step({ code: 'b', path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
  ],
})

/**
 * The submit hook declares no `validate` flag. Forward analysis keeps
 * onAlways redirect targets regardless, so `b` stays reachable.
 */
export const onAlwaysForwardJourney = journey({
  code: 'on-always',
  path: '/on-always',
  title: 'onAlways forward propagation',
  onAccess: [access({ effects: [Effects.LoadAnswers('on-always')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ onAlways: { next: [redirect({ goto: 'b' })] } })],
    }),
    step({ code: 'b', path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
  ],
})

/**
 * The submit hook declares onValid outcomes but no `validate` flag. Forward
 * analysis only follows onValid redirects on validating hooks, so `b` is
 * unreachable even though a submission would take the onValid branch.
 */
export const onValidNoValidateJourney = journey({
  code: 'on-valid-off',
  path: '/on-valid-off',
  title: 'onValid without validate',
  onAccess: [access({ effects: [Effects.LoadAnswers('on-valid-off')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ onValid: { next: [redirect({ goto: 'b' })] } })],
    }),
    step({ code: 'b', path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
  ],
})

/**
 * A guarded redirect followed by an unconditional one: forward analysis
 * compiles the cascade as first-match, so only one target is reachable for
 * any given value of `routeFirst`.
 */
export const cascadeForwardJourney = journey({
  code: 'cascade',
  path: '/cascade',
  title: 'Forward outcome cascade',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('cascade')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [
              redirect({ when: Data('routeFirst').match(Condition.Equals(true)), goto: 'first' }),
              redirect({ goto: 'second' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'first', path: '/first', title: 'First', blocks: [StaticText({ text: 'First' })] }),
    step({ code: 'second', path: '/second', title: 'Second', blocks: [StaticText({ text: 'Second' })] }),
  ],
})

/**
 * The first redirect's goto is a data-backed expression: when it resolves to
 * a step code that step is reachable and the cascade stops; when it resolves
 * to undefined the cascade falls through to the static fallback.
 */
export const dynamicGotoForwardJourney = journey({
  code: 'dyn-goto',
  path: '/dyn-goto',
  title: 'Dynamic goto reachability',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('dyn-goto')] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: Data('target') }), redirect({ goto: 'fallback' })],
          },
        }),
      ],
    }),
    step({ code: 'chosen', path: '/chosen', title: 'Chosen', blocks: [StaticText({ text: 'Chosen' })] }),
    step({ code: 'fallback', path: '/fallback', title: 'Fallback', blocks: [StaticText({ text: 'Fallback' })] }),
  ],
})

/**
 * The parent disables reachability checks and the child journey says nothing,
 * so the child inherits the disabled walk and every child step is reachable.
 */
export const nestedDisabledChecksJourney = journey({
  code: 'nested-off',
  path: '/nested-off',
  title: 'Nested disabled checks',
  reachability: { disableReachabilityChecks: true },
  steps: [step({ path: '/home', title: 'Home', blocks: [StaticText({ text: 'Home' })] })],
  children: [
    journey({
      code: 'child',
      path: '/child',
      title: 'Child',
      steps: [
        step({ path: '/a', title: 'A', blocks: [StaticText({ text: 'A' })] }),
        step({ path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
      ],
    }),
  ],
})

/**
 * The parent disables reachability checks but the child overrides with an
 * explicit `false`, so the child's own walk applies and its second step is
 * unreachable again.
 */
export const nestedOverrideChecksJourney = journey({
  code: 'nested-on',
  path: '/nested-on',
  title: 'Nested override checks',
  reachability: { disableReachabilityChecks: true },
  steps: [step({ path: '/home', title: 'Home', blocks: [StaticText({ text: 'Home' })] })],
  children: [
    journey({
      code: 'child',
      path: '/child',
      title: 'Child',
      reachability: { disableReachabilityChecks: false },
      steps: [
        step({
          code: 'a',
          path: '/a',
          title: 'A',
          reachability: { entryWhen: true },
          blocks: [StaticText({ text: 'A' })],
        }),
        step({ code: 'b', path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
      ],
    }),
  ],
})

export const disabledChecksJourney = journey({
  code: 'no-checks',
  path: '/no-checks',
  title: 'Disabled reachability checks',
  reachability: { disableReachabilityChecks: true },
  steps: [
    step({ path: '/a', title: 'A', blocks: [StaticText({ text: 'A' })] }),
    step({ path: '/b', title: 'B', blocks: [StaticText({ text: 'B' })] }),
    step({ path: '/c', title: 'C', blocks: [StaticText({ text: 'C' })] }),
  ],
})

export const tieBreakerEntryJourney = journey({
  code: 'tie-entry',
  path: '/tie-entry',
  title: 'Tie-breaker entry',
  steps: [
    step({
      path: '/first',
      title: 'First',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'First' })],
    }),
    step({
      path: '/second',
      title: 'Second',
      reachability: { entryWhen: true, tieBreakers: [tieBreaker({ priority: 100 })] },
      blocks: [StaticText({ text: 'Second' })],
    }),
  ],
})

export const conditionalTieBreakerJourney = journey({
  code: 'tie-cond',
  path: '/tie-cond',
  title: 'Conditional tie-breaker',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/first',
      title: 'First',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'First' })],
    }),
    step({
      path: '/second',
      title: 'Second',
      reachability: {
        entryWhen: true,
        tieBreakers: [tieBreaker({ priority: 100, when: Data('preferSecond').match(Condition.Equals(true)) })],
      },
      blocks: [StaticText({ text: 'Second' })],
    }),
  ],
})

export const orderedTieBreakerJourney = journey({
  code: 'tie-order',
  path: '/tie-order',
  title: 'Ordered tie-breaker rules',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/one',
      title: 'One',
      reachability: { entryWhen: true, tieBreakers: [tieBreaker({ priority: 50 })] },
      blocks: [StaticText({ text: 'One' })],
    }),
    step({
      path: '/two',
      title: 'Two',
      reachability: {
        entryWhen: true,
        tieBreakers: [
          tieBreaker({ priority: 10, when: Data('lowPriority').match(Condition.Equals(true)) }),
          tieBreaker({ priority: 100 }),
        ],
      },
      blocks: [StaticText({ text: 'Two' })],
    }),
  ],
})

export const conditionalEntryStepJourney = journey({
  code: 'cond-entry',
  path: '/cond-entry',
  title: 'Conditional entry step',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/standard',
      title: 'Standard',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Standard flow' })],
    }),
    step({
      path: '/premium',
      title: 'Premium',
      reachability: { entryWhen: Data('isPremium').match(Condition.Equals(true)) },
      blocks: [StaticText({ text: 'Premium flow' })],
    }),
  ],
})

export const entryNotFirstStepJourney = journey({
  code: 'entry-not-first',
  path: '/entry-not-first',
  title: 'Entry is not the first declared step',
  steps: [
    step({
      path: '/preamble',
      title: 'Preamble',
      blocks: [StaticText({ text: 'Preamble' })],
    }),
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'preamble' })] } })],
    }),
  ],
})

/**
 * Mirrors the real "resuming" demo: a validation-free info step is the default
 * landing entry (highest tie-breaker), alongside the first question entry. The
 * info step has no onward navigation, so if resume ever treats it as completed
 * progress it wins the tie-break and finds no frontier, stalling on the current
 * step instead of advancing.
 */
export const resumeWithInfoEntryJourney = journey({
  code: 'resume-info',
  path: '/resume-info',
  title: 'Resume with info entry',
  reachability: { resumeWhen: true },
  onAccess: [access({ effects: [Effects.LoadAnswers('resume-info')] })],
  steps: [
    step({
      path: '/overview',
      title: 'Overview',
      reachability: { entryWhen: true, tieBreakers: [tieBreaker({ priority: 100 })] },
      blocks: [StaticText({ text: 'Overview' })],
    }),
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'firstName',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'role' })] } })],
    }),
    step({
      path: '/role',
      title: 'Role',
      blocks: [
        TextField({
          code: 'lastName',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'done' })] } })],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [StaticText({ text: 'Done' })] }),
  ],
})

export const unreachableRedirectsToEntryJourney = journey({
  code: 'unreach-entry',
  path: '/unreach-entry',
  title: 'Unreachable redirects to entry',
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'step-two' })],
          },
        }),
      ],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      blocks: [StaticText({ text: 'Done' })],
    }),
  ],
})
