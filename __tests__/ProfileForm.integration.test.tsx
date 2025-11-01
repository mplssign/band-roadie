import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileForm from '@/app/(protected)/profile/ProfileForm';
import type { User } from '@/lib/types';

// Mock next/navigation useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ 
  useRouter: () => ({ 
    push: mockPush,
    refresh: jest.fn(), 
    back: jest.fn() 
  }) 
}));

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

  test('opens dialog for adding custom role', async () => {
    render(<ProfileForm user={user as unknown as User} />);

    // Find and click the + Add button
    const addButton = screen.getByRole('button', { name: '+ Add' });
    fireEvent.click(addButton);

    // Wait for dialog to open and verify elements exist
    const input = await screen.findByPlaceholderText('e.g. Rhythm Guitar');
    expect(input).toBeInTheDocument();

    const addModalButton = screen.getByRole('button', { name: 'Add' });
    expect(addModalButton).toBeInTheDocument();

    const cancelModalButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelModalButton).toBeInTheDocument();
  });

  test('Cancel button navigates to dashboard', () => {
    render(<ProfileForm user={user as unknown as User} />);

    // Find the Cancel button
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Verify navigation was called
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  test('renders Save Profile button', () => {
    render(<ProfileForm user={user as unknown as User} />);

    // Verify the Save Profile button exists
    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    expect(saveButton).toBeInTheDocument();
  });
});
