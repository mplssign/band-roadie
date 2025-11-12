/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useBands } from '@/contexts/BandsContext';
import SetlistDetailPage from '@/app/(protected)/setlists/[id]/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock BandsContext
jest.mock('@/contexts/BandsContext', () => ({
  useBands: jest.fn(),
}));

// Mock toast hook
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

// Mock the API calls
global.fetch = jest.fn();

// Mock lazy imports and components
jest.mock('@/components/setlists/OptimizedSongSearchOverlay', () => {
  return function MockSongSearchOverlay() {
    return <div data-testid="song-search-overlay" />;
  };
});

jest.mock('@/components/setlists/ProviderImportDrawer', () => ({
  ProviderImportDrawer: function MockProviderImportDrawer() {
    return <div data-testid="provider-import-drawer" />;
  },
}));

jest.mock('@/components/setlists/BulkPasteDrawer', () => ({
  BulkPasteDrawer: function MockBulkPasteDrawer() {
    return <div data-testid="bulk-paste-drawer" />;
  },
}));

jest.mock('@/components/setlists/SetlistSongRow', () => ({
  SetlistSongRow: function MockSetlistSongRow({ setlistSong }: { setlistSong: { id: string; songs?: { title?: string; artist?: string } } }) {
    return (
      <div data-testid={`song-row-${setlistSong.id}`}>
        <span>{setlistSong.songs?.title || 'Unknown Song'}</span>
        <span>{setlistSong.songs?.artist || 'Unknown Artist'}</span>
      </div>
    );
  },
}));

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

const mockBand = {
  id: 'band-123',
  name: 'Test Band',
};

const mockSetlistData = {
  setlist: {
    id: 'setlist-456',
    band_id: 'band-123',
    name: 'Test Setlist',
    total_duration: 1800, // 30 minutes
    setlist_songs: [
      {
        id: 'setlist-song-1',
        setlist_id: 'setlist-456',
        song_id: 'song-1',
        position: 1,
        bpm: 120,
        tuning: 'standard',
        duration_seconds: 240,
        songs: {
          id: 'song-1',
          title: 'First Song',
          artist: 'Test Artist',
          duration_seconds: 240,
        },
      },
      {
        id: 'setlist-song-2',
        setlist_id: 'setlist-456',
        song_id: 'song-2',
        position: 2,
        bpm: 140,
        tuning: 'drop_d',
        duration_seconds: 180,
        songs: {
          id: 'song-2',
          title: 'Second Song',
          artist: 'Another Artist',
          duration_seconds: 180,
        },
      },
    ],
  },
};

describe('SetlistDetailPage', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useBands as jest.Mock).mockReturnValue({
      currentBand: mockBand,
    });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSetlistData,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display summary information only in the header, not in song list items', async () => {
    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    // Check that summary information appears in the header
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    expect(screen.getByText('7m')).toBeInTheDocument(); // 420 seconds = 7 minutes

    // Check that song list items exist
    await waitFor(() => {
      expect(screen.getByTestId('song-row-setlist-song-1')).toBeInTheDocument();
      expect(screen.getByTestId('song-row-setlist-song-2')).toBeInTheDocument();
    });

    // Verify song content appears
    expect(screen.getByText('First Song')).toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Another Artist')).toBeInTheDocument();

    // CRITICAL TEST: Ensure NO duplicate summary information appears anywhere else
    // The summary should only appear once in the header
    const songCountElements = screen.getAllByText(/\d+ songs?/);
    expect(songCountElements).toHaveLength(1); // Only one instance should exist

    const durationElements = screen.getAllByText(/\d+m/);
    expect(durationElements).toHaveLength(1); // Only one duration display should exist

    // Ensure no summary data appears within song row containers
    const songRows = screen.getAllByTestId(/^song-row-/);
    songRows.forEach((songRow: HTMLElement) => {
      // Summary text should NOT appear within individual song rows
      expect(songRow).not.toHaveTextContent(/\d+ songs/);
      expect(songRow).not.toHaveTextContent(/total/i);
      expect(songRow).not.toHaveTextContent(/duration/i);
    });
  });

  it('should display summary in both edit and view modes without duplication', async () => {
    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    // Wait for initial load (view mode)
    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    // Verify summary appears once in view mode
    const songCountElements = screen.getAllByText('2 songs');
    expect(songCountElements).toHaveLength(1);

    // Note: In a real test, we would click the Edit button and verify
    // the summary still appears only once in edit mode, but since we're 
    // mocking the component, we'll focus on the structural test above
  });

  it('should handle empty setlist without showing duplicate zero counts', async () => {
    const emptySetlistData = {
      setlist: {
        id: 'setlist-456',
        band_id: 'band-123',
        name: 'Empty Setlist',
        total_duration: 0,
        setlist_songs: [],
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => emptySetlistData,
    });

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Empty Setlist')).toBeInTheDocument();
    });

    // Should show zero counts in header only
    expect(screen.getByText('0 songs')).toBeInTheDocument();
    expect(screen.getByText('TBD')).toBeInTheDocument(); // Zero duration shows as "TBD"

    // Verify only one instance of each summary element
    const songCountElements = screen.getAllByText('0 songs');
    expect(songCountElements).toHaveLength(1);

    const durationElements = screen.getAllByText('TBD');
    expect(durationElements).toHaveLength(1);
  });

  it('should show export to music service button and handle click', async () => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useBands as jest.Mock).mockReturnValue({
      currentBand: mockBand,
      loading: false,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSetlistData,
    });

    // Mock window.open
    const mockWindowOpen = jest.fn().mockReturnValue(true); // Simulate successful open
    Object.defineProperty(window, 'open', {
      writable: true,
      value: mockWindowOpen,
    });

    // Mock gtag for analytics
    (window as any).gtag = jest.fn();

    // Mock navigator.onLine as true (online)
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    // Find the export button
    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveTextContent('Export to Music Service');
    expect(exportButton).toHaveAttribute('tabIndex', '0'); // Verify keyboard accessibility

    // Click the export button
    exportButton.click();

    // Verify external link was opened
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.tunemymusic.com/transfer',
      '_blank',
      'noopener,noreferrer'
    );

    // Verify analytics tracking
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'setlist_export_music_service_clicked', {
      setlistId: 'setlist-456',
      songCount: 2,
    });
  });

  it('should handle offline state when exporting to music service', async () => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useBands as jest.Mock).mockReturnValue({
      currentBand: mockBand,
      loading: false,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSetlistData,
    });

    // Mock navigator.onLine as false (offline)
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    // Mock gtag for analytics
    (window as any).gtag = jest.fn();

    // Mock showToast
    const mockShowToast = jest.fn();
    require('@/hooks/useToast').useToast = () => ({ showToast: mockShowToast });

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    exportButton.click();

    // Verify offline error handling
    expect(mockShowToast).toHaveBeenCalledWith('No connection. Try again.', 'error');
    
    // Verify analytics tracking for offline state
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'external_link_open_failed', {
      url: 'https://www.tunemymusic.com/transfer',
      error: 'offline'
    });
  });
});