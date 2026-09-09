import mermaid from 'mermaid'

const mermaidConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  flowchart: {
    htmlLabels: false,
  },
  themeVariables: {
    background: '#ffffff',
    primaryColor: '#d2e2f1',
    primaryTextColor: '#0b0c0c',
    primaryBorderColor: '#1d70b8',
    secondaryColor: '#f3f2f1',
    secondaryTextColor: '#0b0c0c',
    secondaryBorderColor: '#505a5f',
    tertiaryColor: '#ffdd00',
    tertiaryTextColor: '#0b0c0c',
    tertiaryBorderColor: '#0b0c0c',
    lineColor: '#505a5f',
    edgeLabelBackground: '#ffffff',
    fontFamily: '"GDS Transport", arial, sans-serif',
    fontSize: '16px',
  },
}

function getContentSecurityPolicyNonce() {
  return document.querySelector('script[data-csp-nonce]')?.dataset.cspNonce
}

function addNonceToStyles(svg, nonce) {
  if (!nonce) {
    return svg
  }

  return svg.replace(/<style(?=[\s>])/g, `<style nonce="${nonce}"`)
}

export async function initMermaid() {
  const diagramElements = [...document.querySelectorAll('.forge-mermaid .mermaid')]

  if (diagramElements.length === 0) {
    return
  }

  mermaid.initialize(mermaidConfig)

  const nonce = getContentSecurityPolicyNonce()

  await Promise.all(
    diagramElements.map(async (diagramElement, index) => {
      const source = diagramElement.textContent
      const { svg } = await mermaid.render(`forge-mermaid-${index + 1}`, source)

      diagramElement.innerHTML = addNonceToStyles(svg, nonce)
    }),
  )
}
