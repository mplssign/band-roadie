import { sanitizeAppPath } from '@/lib/auth/session';

describe('sanitizeAppPath', () => {
  it('returns the path when safe', () => {
    expect(sanitizeAppPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeAppPath('/profile?welcome=true')).toBe('/profile?welcome=true');
  });

  it('rejects external or unsafe values', () => {
    expect(sanitizeAppPath('https://example.com')).toBeNull();
    expect(sanitizeAppPath('//malicious')).toBeNull();
    expect(sanitizeAppPath('')).toBeNull();
    expect(sanitizeAppPath(null)).toBeNull();
  });
});
