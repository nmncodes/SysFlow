import { describe, expect, it } from 'vitest'
import { generateDockerCompose } from './iac'

describe('generateDockerCompose', () => {
  it('creates distinct valid service names and host ports for colliding node IDs and service types', () => {
    const compose = generateDockerCompose([
      { id: 'API', type: 'loadBalancer', label: 'Public API' },
      { id: 'api', type: 'loadBalancer', label: 'Internal API' },
      { id: '1-cache', type: 'cache', label: 'Cache' },
    ], [])

    expect(compose).toContain('api:')
    expect(compose).toContain('api_2:')
    expect(compose).toContain('svc_1-cache:')
    expect(compose).toContain('"80:80"')
    expect(compose).toContain('"81:80"')
    expect(compose).toContain('"6379:6379"')
  })

  it('keeps dependencies acyclic and explains skipped platform-only components', () => {
    const compose = generateDockerCompose([
      { id: 'api', type: 'service', label: 'API' },
      { id: 'worker', type: 'worker', label: 'Worker' },
      { id: 'browser', type: 'webBrowser', label: 'Browser' },
    ], [
      { source: 'api', target: 'worker' },
      { source: 'worker', target: 'api' },
    ])

    expect(compose).toContain('#   - Browser (webBrowser): runs on the end user\'s device — not a backend service')
    expect(compose).toContain('# Dependencies omitted to keep the Compose service graph acyclic:')
    expect((compose.match(/    depends_on:/g) ?? []).length).toBe(1)
  })

  it('rejects empty or duplicate node IDs rather than producing ambiguous Compose output', () => {
    expect(() => generateDockerCompose([{ id: 'same', type: 'cache' }, { id: 'same', type: 'database' }], []))
      .toThrow('every graph node must have a unique, non-empty ID')
    expect(() => generateDockerCompose([{ id: '  ', type: 'cache' }], []))
      .toThrow('every graph node must have a unique, non-empty ID')
  })
})
