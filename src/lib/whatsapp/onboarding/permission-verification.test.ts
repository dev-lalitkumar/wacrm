import { describe, it, expect } from 'vitest'

const REQUIRED = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

function missingScopes(scopes: string[]): string[] {
  return REQUIRED.filter((s) => !scopes.includes(s))
}

describe('permission requirements', () => {
  it('detects missing scopes', () => {
    expect(missingScopes(['business_management'])).toEqual([
      'whatsapp_business_management',
      'whatsapp_business_messaging',
    ])
    expect(missingScopes(REQUIRED)).toEqual([])
  })
})
