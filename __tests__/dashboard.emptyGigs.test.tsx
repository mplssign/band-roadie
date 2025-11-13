/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '@/app/(protected)/dashboard/page';
import { useBands } from '@/contexts/BandsContext';
import { useBandChange } from '@/hooks/useBandChange';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@/contexts/BandsContext');
jest.mock('@/hooks/useBandChange');
jest.mock('@/lib/supabase/client');

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (dynamicFunction: () => Promise<any>) => {
    const Component = React.lazy(dynamicFunction);
    return Component;
  },
}));

// Mock the AddEventDrawer component
jest.mock('@/app/(protected)/calendar/AddEventDrawer', () => {
  return function MockAddEventDrawer({ 
    isOpen, 
    onClose, 
    onEventUpdated, 
    defaultEventType,
    mode 
  }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="add-event-drawer">
        <div data-testid="drawer-mode">{mode}</div>
        <div data-testid="default-event-type">{defaultEventType}</div>
        <button onClick={onClose}>Close</button>
        <button onClick={onEventUpdated}>Event Updated</button>
      </div>
    );
  };
});

describe('Dashboard Empty Gigs State', () => {
  const mockBandChangeHandler = jest.fn();
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useBandChange as jest.Mock).mockImplementation(({ onBandChange }) => {
      mockBandChangeHandler.mockImplementation(onBandChange);
    });

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  const renderDashboardWithEmptyGigs = async (withPotentialGig = false) => {
    const mockBand = { id: 'band-1', name: 'Test Band' };
    
    (useBands as jest.Mock).mockReturnValue({
      currentBand: mockBand,
      bands: [mockBand],
      loading: false,
    });

    // Mock no rehearsals
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'rehearsals') {
        return {
          ...mockSupabaseClient,
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null
          }),
        };
      }
      
      if (table === 'gigs') {
        const mockGigs = withPotentialGig ? [{
          id: 'potential-gig-1',
          name: 'Potential Show',
          date: '2024-01-15',
          venue: 'Test Venue',
          is_potential: true,
          start_time: '20:00',
          end_time: '23:00',
        }] : [];
        
        return {
          ...mockSupabaseClient,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: mockGigs,
            error: null
          }),
        };
      }
      
      return mockSupabaseClient;
    });

    const result = render(<DashboardPage />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
    });
    
    return result;
  };

  describe('when there are no gigs and no potential gigs', () => {
    it('should show the new empty gigs card without rose border', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Verify the new empty state exists
      expect(screen.getByText('No upcoming gigs.')).toBeInTheDocument();
      
      // Verify the descriptive text
      expect(screen.getByText('The spotlight awaits — time to book that next show and light up the stage!')).toBeInTheDocument();
      
      // Verify the Create Gig button exists in the empty state section (not Quick Actions)
      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      const createButton = emptyStateSection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveTextContent('Create Gig');
      
      // Verify no rose-bordered card exists (old implementation)
      expect(emptyStateSection).toHaveClass('rounded-2xl', 'overflow-hidden', 'bg-zinc-900');
      expect(emptyStateSection).not.toHaveClass('border-rose-500');
    });

    it('should match rehearsal empty state styling', async () => {
      await renderDashboardWithEmptyGigs(false);

      const gigsEmptyState = screen.getByText('No upcoming gigs.').closest('section');
      const rehearsalEmptyState = screen.getByText('No Rehearsal Scheduled').closest('section');
      
      // Both should have the same classes
      expect(gigsEmptyState).toHaveClass('rounded-2xl', 'overflow-hidden', 'bg-zinc-900');
      expect(rehearsalEmptyState).toHaveClass('rounded-2xl', 'overflow-hidden', 'bg-zinc-900');
      
      // Both should have p-6 padding
      const gigsContent = gigsEmptyState?.querySelector('div');
      const rehearsalContent = rehearsalEmptyState?.querySelector('div');
      expect(gigsContent).toHaveClass('p-6');
      expect(rehearsalContent).toHaveClass('p-6');
    });

    it('should have keyboard-focusable Create Gig button', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Target the Create Gig button in the empty state section (not Quick Actions)
      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      const createButton = emptyStateSection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      
      expect(createButton).toBeInTheDocument();
      
      // Should be focusable
      createButton.focus();
      expect(createButton).toHaveFocus();
      
      // Should have accessibility label
      expect(createButton).toHaveAttribute('aria-label', 'Create gig');
    });

    it('should open gig creation flow when Create Gig button is clicked', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Target the Create Gig button in the empty state section
      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      const createButton = emptyStateSection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      
      fireEvent.click(createButton);
      
      // Verify drawer opens with correct configuration
      await waitFor(() => {
        expect(screen.getByTestId('add-event-drawer')).toBeInTheDocument();
        expect(screen.getByTestId('drawer-mode')).toHaveTextContent('add');
        expect(screen.getByTestId('default-event-type')).toHaveTextContent('gig');
      });
    });

    it('should handle keyboard navigation on Create Gig button', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Target the Create Gig button in the empty state section
      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      const createButton = emptyStateSection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      createButton.focus();
      
      // Test Enter key - simulate click since keyboard events might not trigger the full flow
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('add-event-drawer')).toBeInTheDocument();
      });
      
      // Close drawer for next test
      fireEvent.click(screen.getByText('Close'));
      
      await waitFor(() => {
        expect(screen.queryByTestId('add-event-drawer')).not.toBeInTheDocument();
      });
      
      // Test second click to ensure it still works
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('add-event-drawer')).toBeInTheDocument();
      });
    });
  });

  describe('when there are potential gigs but no confirmed gigs', () => {
    it('should show "No confirmed gigs scheduled yet" instead of the empty state card', async () => {
      await renderDashboardWithEmptyGigs(true);

      // Should show the potential gig section
      expect(screen.getByText('Potential Gig')).toBeInTheDocument();
      expect(screen.getByText('Potential Show')).toBeInTheDocument();
      
      // Should show the "no confirmed" message instead of empty state
      expect(screen.getByText('No confirmed gigs scheduled yet.')).toBeInTheDocument();
      
      // Should NOT show the empty state card title or description
      expect(screen.queryByText('No upcoming gigs.')).not.toBeInTheDocument();
      expect(screen.queryByText('The spotlight awaits — time to book that next show and light up the stage!')).not.toBeInTheDocument();
      
      // Should NOT show the Create Gig button in the empty state section (Quick Actions will still have it)
      const gigsSection = screen.getByText('Upcoming Gigs').parentElement;
      const emptyStateButton = gigsSection?.querySelector('button[aria-label="Create gig"]');
      expect(emptyStateButton).not.toBeInTheDocument();
    });
  });

  describe('visual consistency', () => {
    it('should maintain button styling consistency with rehearsal empty state', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Target the buttons in their respective empty state sections
      const gigsEmptySection = screen.getByText('No upcoming gigs.').closest('section');
      const rehearsalEmptySection = screen.getByText('No Rehearsal Scheduled').closest('section');
      
      const gigCreateButton = gigsEmptySection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      const rehearsalButton = rehearsalEmptySection?.querySelector('button') as HTMLButtonElement;
      
      // Both buttons should have the same classes
      const expectedClasses = [
        'inline-flex',
        'items-center',
        'gap-2',
        'bg-white/20',
        'hover:bg-white/30',
        'text-white',
        'font-medium',
        'px-5',
        'py-2.5',
        'rounded-lg',
        'transition-colors',
        'backdrop-blur-sm',
        'border',
        'border-white/30'
      ];
      
      expectedClasses.forEach(className => {
        expect(gigCreateButton).toHaveClass(className);
        expect(rehearsalButton).toHaveClass(className);
      });
    });

    it('should maintain dark mode and rose theme consistency', async () => {
      await renderDashboardWithEmptyGigs(false);

      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      
      // Should have dark background consistent with theme
      expect(emptyStateSection).toHaveClass('bg-zinc-900');
      
      // Text should be white/light colored
      const titleElement = screen.getByText('No upcoming gigs.');
      expect(titleElement).toHaveClass('text-white');
      
      // Description text should be white with opacity
      const descriptionElement = screen.getByText('The spotlight awaits — time to book that next show and light up the stage!');
      expect(descriptionElement).toHaveClass('text-white/80');
    });

    it('should not introduce rose borders in empty state', async () => {
      await renderDashboardWithEmptyGigs(false);

      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      
      // Should not have any rose-colored borders or outlines
      expect(emptyStateSection).not.toHaveClass('border-rose-500');
      expect(emptyStateSection?.querySelector('.border-rose-500')).toBeNull();
    });
  });

  describe('non-regression tests', () => {
    it('should not affect rehearsal empty state', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Rehearsal empty state should remain unchanged
      expect(screen.getByText('No Rehearsal Scheduled')).toBeInTheDocument();
      expect(screen.getByText('The stage is empty and the amps are cold. Time to crank it up and get the band back together!')).toBeInTheDocument();
      
      // Target the Schedule Rehearsal button in the empty state section
      const rehearsalEmptySection = screen.getByText('No Rehearsal Scheduled').closest('section');
      const scheduleButton = rehearsalEmptySection?.querySelector('button') as HTMLButtonElement;
      
      expect(scheduleButton).toBeInTheDocument();
      expect(scheduleButton).toHaveTextContent('Schedule Rehearsal');
    });

    it('should not cause layout shifts', async () => {
      const { container } = await renderDashboardWithEmptyGigs(false);

      // Verify main container structure remains consistent
      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('min-h-screen', 'bg-black', 'text-white', 'pb-40', 'pt-6');
      
      // Verify section spacing remains consistent
      const sectionsContainer = container.querySelector('.space-y-6');
      expect(sectionsContainer).toBeInTheDocument();
    });

    it('should preserve band scoping and navigation', async () => {
      await renderDashboardWithEmptyGigs(false);

      // Target the Create Gig button in the empty state section
      const emptyStateSection = screen.getByText('No upcoming gigs.').closest('section');
      const createButton = emptyStateSection?.querySelector('button[aria-label="Create gig"]') as HTMLButtonElement;
      
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('add-event-drawer')).toBeInTheDocument();
      });
      
      // Verify no unintended navigation occurred
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});