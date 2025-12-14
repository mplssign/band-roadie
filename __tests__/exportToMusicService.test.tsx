/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock clipboard API - setup proper JSDOM environment
const mockWriteText = jest.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: mockWriteText,
  },
});

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', { 
  value: mockWindowOpen,
  writable: true 
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock gtag for analytics
declare global {
  interface Window {
    gtag: jest.Mock;
  }
}
Object.defineProperty(window, 'gtag', {
  writable: true,
  value: jest.fn(),
});

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

const mockSetlistWithSongs = {
  setlist: {
    id: 'setlist-456',
    band_id: 'band-123',
    name: 'Test Setlist',
    total_duration: 1800,
    setlist_songs: [
      {
        id: 'setlist-song-1',
        setlist_id: 'setlist-456',
        song_id: 'song-1',
        position: 1,
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
        duration_seconds: 180,
        songs: {
          id: 'song-2',
          title: 'Second Song',
          artist: 'Another Artist',
          duration_seconds: 180,
        },
      },
      {
        id: 'setlist-song-3',
        setlist_id: 'setlist-456',
        song_id: 'song-3',
        position: 3,
        duration_seconds: 200,
        songs: {
          id: 'song-3',
          title: 'Third Song',
          artist: 'Final Artist',
          duration_seconds: 200,
        },
      },
    ],
  },
};

const mockEmptySetlist = {
  setlist: {
    id: 'setlist-789',
    band_id: 'band-123',
    name: 'Empty Setlist',
    total_duration: 0,
    setlist_songs: [],
  },
};

describe('Export to Music Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useBands as jest.Mock).mockReturnValue({
      currentBand: mockBand,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSetlistWithSongs),
    });
    // Reset navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    // Reset window.open mock
    mockWindowOpen.mockReturnValue(true);
    // Reset clipboard mock
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
  });

  it('should disable export button when setlist is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEmptySetlist),
    });

    render(<SetlistDetailPage params={{ id: 'setlist-789' }} />);

    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
      expect(exportButton).toBeDisabled();
      expect(exportButton).toHaveAttribute('title', 'Add songs to export this setlist');
    });

    // Check that empty setlist hint is shown
    expect(screen.getByText('Add songs to export this setlist.')).toBeInTheDocument();
  });

  it('should copy setlist to clipboard in correct format and open URL', async () => {
    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    expect(exportButton).not.toBeDisabled();

    await userEvent.click(exportButton);

    await waitFor(() => {
      // Check clipboard was called with correct format
      expect(mockWriteText).toHaveBeenCalledWith(
        'First Song — Test Artist\nSecond Song — Another Artist\nThird Song — Final Artist'
      );
    });

    // Check toast was shown
    expect(mockShowToast).toHaveBeenCalledWith('Setlist copied to clipboard.', 'success');

    // Check URL was opened
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.tunemymusic.com/transfer',
      '_blank',
      'noopener,noreferrer'
    );

    // Check analytics tracking
    expect(window.gtag).toHaveBeenCalledWith('event', 'setlist_export_music_service_clicked', {
      setlistId: 'setlist-456',
      songCount: 3,
    });
  });

  it('should handle clipboard failure and not open URL', async () => {
    // Mock clipboard failure
    mockWriteText.mockRejectedValue(new Error('Clipboard error'));

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    await userEvent.click(exportButton);

    await waitFor(() => {
      // Check error toast was shown
      expect(mockShowToast).toHaveBeenCalledWith('Failed to copy setlist to clipboard', 'error');
    });

    // Check URL was NOT opened due to clipboard failure
    expect(mockWindowOpen).not.toHaveBeenCalled();

    // Check analytics tracking for clipboard failure
    expect(window.gtag).toHaveBeenCalledWith('event', 'clipboard_copy_failed', {
      setlistId: 'setlist-456',
      error: 'Clipboard error',
    });
  });

  it('should handle offline state', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    await userEvent.click(exportButton);

    await waitFor(() => {
      // Check offline toast was shown
      expect(mockShowToast).toHaveBeenCalledWith('No connection. Try again.', 'error');
    });

    // Check URL was NOT opened due to offline state
    expect(mockWindowOpen).not.toHaveBeenCalled();
    // Check clipboard was NOT called due to offline state
    expect(mockWriteText).not.toHaveBeenCalled();

    // Check analytics tracking for offline
    expect(window.gtag).toHaveBeenCalledWith('event', 'external_link_open_failed', {
      url: 'https://www.tunemymusic.com/transfer',
      error: 'offline',
    });
  });

  it('should handle popup blocked scenario', async () => {
    // Mock window.open returning null (popup blocked)
    mockWindowOpen.mockReturnValue(null);

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    await userEvent.click(exportButton);

    await waitFor(() => {
      // Check clipboard was called successfully first
      expect(mockWriteText).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Setlist copied to clipboard.', 'success');
    });

    await waitFor(() => {
      // Check error toast for popup blocked (after successful clipboard)
      expect(mockShowToast).toHaveBeenCalledWith('Failed to open music service', 'error');
    });

    // Check analytics tracking for popup blocked
    expect(window.gtag).toHaveBeenCalledWith('event', 'external_link_open_failed', {
      url: 'https://www.tunemymusic.com/transfer',
      error: 'Popup blocked or external linking not allowed',
    });
  });

  it('should handle songs with missing artist information', async () => {
    const setlistWithUnknownArtist = {
      setlist: {
        ...mockSetlistWithSongs.setlist,
        setlist_songs: [
          {
            id: 'setlist-song-1',
            setlist_id: 'setlist-456',
            song_id: 'song-1',
            position: 1,
            duration_seconds: 240,
            songs: {
              id: 'song-1',
              title: 'Song Without Artist',
              artist: null, // No artist
              duration_seconds: 240,
            },
          },
          {
            id: 'setlist-song-2',
            setlist_id: 'setlist-456',
            song_id: 'song-2',
            position: 2,
            duration_seconds: 180,
            songs: {
              id: 'song-2',
              title: 'Song With Artist',
              artist: 'Known Artist',
              duration_seconds: 180,
            },
          },
        ],
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(setlistWithUnknownArtist),
    });

    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      expect(screen.getByText('Test Setlist')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
    await userEvent.click(exportButton);

    await waitFor(() => {
      // Check clipboard was called with correct format including "Unknown Artist"
      expect(mockWriteText).toHaveBeenCalledWith(
        'Song Without Artist — Unknown Artist\nSong With Artist — Known Artist'
      );
    });
  });

  it('should maintain accessibility properties', async () => {
    render(<SetlistDetailPage params={{ id: 'setlist-456' }} />);

    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: /export setlist to music service/i });
      
      // Check accessibility properties
      expect(exportButton).toHaveAttribute('aria-label', 'Export setlist to music service');
      expect(exportButton).toHaveAttribute('title', 'Export to Music Service');
      expect(exportButton).toHaveAttribute('tabIndex', '0');
    });
  });
});