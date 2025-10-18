import { capitalizeWords } from '@/app/(protected)/profile/ProfileForm';

describe('capitalizeWords', () => {
  test('capitalizes each word correctly', () => {
    expect(capitalizeWords('hello world')).toBe('Hello World');
    expect(capitalizeWords('MULTIPLE   spaces')).toBe('Multiple Spaces');
    expect(capitalizeWords('')).toBe('');
    expect(capitalizeWords('a')).toBe('A');
    expect(capitalizeWords('teSTing CaSe')).toBe('Testing Case');
  });
});
