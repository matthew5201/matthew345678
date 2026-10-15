import { describe, expect, it } from 'vitest'
import { formatSize, normalizeCode, safeStorageName } from './format'

describe('safeStorageName', () => {
  it('replaces unsafe characters', () => {
    expect(safeStorageName('我的 照片 (1).png')).toBe('_1_.png')
  })
  it('keeps the extension for long names', () => {
    const name = safeStorageName('a'.repeat(200) + '.pdf')
    expect(name.length).toBeLessThanOrEqual(80)
    expect(name.endsWith('.pdf')).toBe(true)
  })
  it('falls back when nothing is left', () => {
    expect(safeStorageName('...')).toBe('file')
  })
})

describe('formatSize', () => {
  it('formats units', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(20 * 1024 * 1024)).toBe('20.0 MB')
  })
})

describe('normalizeCode', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalizeCode(' ab c 23 ')).toBe('ABC23')
  })
})
