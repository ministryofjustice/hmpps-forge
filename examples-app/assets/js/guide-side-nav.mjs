/**
 * Turn the guide side-nav group headings into disclosure toggles that behave as
 * an accordion: only one sibling group is open at each level.
 *
 * The server renders the group containing the current page open and every other
 * group collapsed. Collapsing is CSS-gated behind `.govuk-frontend-supported`,
 * so without JS all groups stay expanded and the page remains fully usable.
 */
export function initGuideSideNav() {
  document.querySelectorAll('.guide-side-nav__toggle').forEach(toggle => {
    const group = toggle.closest('.guide-side-nav__group')

    if (!group) {
      return
    }

    toggle.addEventListener('click', () => {
      const willOpen = !group.classList.contains('guide-side-nav__group--open')

      if (willOpen) {
        const siblingGroups = Array.from(group.parentElement?.children ?? []).filter(
          sibling => sibling !== group && sibling.classList.contains('guide-side-nav__group--open'),
        )

        siblingGroups.forEach(openGroup => {
          openGroup.classList.remove('guide-side-nav__group--open')
          openGroup.querySelector('.guide-side-nav__toggle')?.setAttribute('aria-expanded', 'false')
        })
      }

      group.classList.toggle('guide-side-nav__group--open', willOpen)
      toggle.setAttribute('aria-expanded', String(willOpen))
    })
  })
}
