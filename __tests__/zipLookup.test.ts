import { lookupZipCode, lookupZipCodeCached } from '@/lib/utils/zip-lookup';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('lookupZipCode (async)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return zip code data for valid zip code', async () => {
    const mockResponse = {
      places: [{
        'place name': 'Beverly Hills',
        'state': 'California',
        'state abbreviation': 'CA'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await lookupZipCode('90210');
    expect(result).toEqual({ 
      city: 'Beverly Hills', 
      state: 'California',
      stateAbbreviation: 'CA' 
    });
    expect(fetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });

  test('should return null when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    const result = await lookupZipCode('60525');
    expect(result).toBeNull();
  });

  test('should return null when API returns bad response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await lookupZipCode('60525');
    expect(result).toBeNull();
  });

  test('should return null for invalid inputs', async () => {
    const result = await lookupZipCode('');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should return null for non-5-digit inputs', async () => {
    const result = await lookupZipCode('123');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should clean zip code input', async () => {
    const mockResponse = {
      places: [{
        'place name': 'Beverly Hills',
        'state': 'California',
        'state abbreviation': 'CA'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await lookupZipCode('902-10');
    expect(result).toEqual({ 
      city: 'Beverly Hills', 
      state: 'California',
      stateAbbreviation: 'CA' 
    });
    expect(fetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });
});

describe('lookupZipCodeCached', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing cache (this is a simplified approach)
  });

  test('should cache results for repeated lookups', async () => {
    const mockResponse = {
      places: [{
        'place name': 'Beverly Hills',
        'state': 'California',
        'state abbreviation': 'CA'
      }]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // First lookup - should hit API
    const result1 = await lookupZipCodeCached('90210');
    expect(result1).toEqual({ 
      city: 'Beverly Hills', 
      state: 'California',
      stateAbbreviation: 'CA' 
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second lookup - should use cache
    const result2 = await lookupZipCodeCached('90210');
    expect(result2).toEqual({ 
      city: 'Beverly Hills', 
      state: 'California',
      stateAbbreviation: 'CA' 
    });
    expect(fetch).toHaveBeenCalledTimes(1); // Should still be 1
  });
});