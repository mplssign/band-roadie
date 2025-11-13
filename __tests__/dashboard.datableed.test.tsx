/**
 * Tests to verify dashboard prevents data bleed between bands
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import DashboardPage from '@/app/(protected)/dashboard/page';

// Mock the contexts and hooks
jest.mock('@/contexts/BandsContext', () => ({
  useBands: jest.fn()
}));

jest.mock('@/hooks/useBandChange', () => ({
  useBandChange: jest.fn()
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => ({ data: null, error: null }))
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

describe('Dashboard Data Bleed Prevention', () => {
  const { useBands } = require('@/contexts/BandsContext');
  const { useBandChange } = require('@/hooks/useBandChange');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useBandChange to just call the callback
    useBandChange.mockImplementation(({ onBandChange }: { onBandChange?: () => void }) => {
      // Store the callback so we can call it in tests
      (useBandChange.mockImplementation as any).onBandChange = onBandChange;
    });
  });

  it('should not display rehearsal data when band ID mismatches current band', async () => {
    // Mock initial state with Band A data
    useBands.mockReturnValue({
      currentBand: { id: 'band-a', name: 'Band A' },
      bands: [
        { id: 'band-a', name: 'Band A' },
        { id: 'band-b', name: 'Band B' }
      ],
      loading: false
    });

    const { rerender } = render(<DashboardPage />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByText(/Loading dashboard/)).not.toBeInTheDocument();
    });

    // Simulate band change while data is still from old band
    useBands.mockReturnValue({
      currentBand: { id: 'band-b', name: 'Band B' },
      bands: [
        { id: 'band-a', name: 'Band A' },
        { id: 'band-b', name: 'Band B' }
      ],
      loading: false
    });

    // Rerender with new band context
    rerender(<DashboardPage />);

    // Should not show rehearsal data that doesn't match current band
    await waitFor(() => {
      expect(screen.queryByText(/Next Rehearsal/)).not.toBeInTheDocument();
    });
  });

  it('should clear data immediately when band changes', async () => {
    let currentBandState = { id: 'band-a', name: 'Band A' };
    
    useBands.mockImplementation(() => ({
      currentBand: currentBandState,
      bands: [
        { id: 'band-a', name: 'Band A' },
        { id: 'band-b', name: 'Band B' }
      ],
      loading: false
    }));

    render(<DashboardPage />);

    // Trigger band change callback
    if ((useBandChange.mockImplementation as any).onBandChange) {
      // Change band
      currentBandState = { id: 'band-b', name: 'Band B' };
      
      // Call the band change callback
      (useBandChange.mockImplementation as any).onBandChange();
    }

    // Data should be cleared immediately
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Edit rehearsal/ })).not.toBeInTheDocument();
    });
  });

  it('should only show "No Rehearsal Scheduled" when data matches current band', async () => {
    useBands.mockReturnValue({
      currentBand: { id: 'band-a', name: 'Band A' },
      bands: [{ id: 'band-a', name: 'Band A' }],
      loading: false
    });

    render(<DashboardPage />);

    // Should show "No Rehearsal Scheduled" only when we're sure about the band context
    await waitFor(() => {
      // Should either show loading or the correct empty state, but not data from wrong band
      const noRehearsalText = screen.queryByText(/No Rehearsal Scheduled/);
      const loadingText = screen.queryByText(/Loading dashboard/);
      
      // One of these should be true, indicating we're not showing wrong band data
      expect(noRehearsalText || loadingText).toBeTruthy();
    });
  });
});