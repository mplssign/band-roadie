import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileForm from '@/app/(protected)/profile/ProfileForm';
import type { User } from '@/lib/types';

// Mock next/router useRouter
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), back: jest.fn() }) }));

// Mock hooks
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/contexts/BandsContext', () => ({ useBands: () => ({ currentBand: null }) }));

// Provide a simple user prop
const user = {
  id: 'user-1',
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890',
  address: '123 Main St',
  zip: '12345',
  birthday: '2000-01-01',
  roles: ['Guitar']
};

describe('ProfileForm integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (typeof url === 'string' && url.endsWith('/api/roles')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'r1', name: 'Rhythm Guitar' }) });
      }
      if (typeof url === 'string' && url.endsWith('/api/profile')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('opens dialog, adds a role, and calls APIs', async () => {
  render(<ProfileForm user={user as unknown as User} />);

    const addButton = screen.getByRole('button', { name: '+ Add' });
    fireEvent.click(addButton);

    // dialog input should be visible
    const input = await screen.findByPlaceholderText('e.g. Rhythm Guitar');
    fireEvent.change(input, { target: { value: 'rhythm guitar' } });

    const submit = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/roles', expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.any(Object));
    });
  });
});
