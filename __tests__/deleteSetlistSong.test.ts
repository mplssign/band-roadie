import { deleteSetlistSong, DeleteResult } from '@/lib/supabase/setlists';

// Mock the Supabase client
const mockMaybeSingle = jest.fn();
const mockDelete = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: mockMaybeSingle
      }))
    })),
    delete: jest.fn(() => ({
      eq: mockDelete
    }))
  }))
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('deleteSetlistSong', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully delete a setlist song with correct ownership', async () => {
    // Setup mocks for successful delete
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'song123', setlist_id: 'setlist456' },
      error: null
    });
    
    mockDelete.mockResolvedValue({
      error: null,
      status: 204
    });

    const result: DeleteResult = await deleteSetlistSong('song123', 'setlist456');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockMaybeSingle).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should fail with NOT_FOUND when setlist song does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null
    });

    const result: DeleteResult = await deleteSetlistSong('nonexistent', 'setlist456');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(result.error?.status).toBe(404);
    expect(result.error?.message).toBe('Setlist song not found');
  });

  it('should fail with SETLIST_MISMATCH when setlist IDs do not match', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'song123', setlist_id: 'different_setlist' },
      error: null
    });

    const result: DeleteResult = await deleteSetlistSong('song123', 'setlist456');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SETLIST_MISMATCH');
    expect(result.error?.status).toBe(403);
    expect(result.error?.message).toBe('Setlist mismatch - unauthorized access');
  });

  it('should detect RLS issues and provide appropriate error messaging', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'song123', setlist_id: 'setlist456' },
      error: null
    });
    
    mockDelete.mockResolvedValue({
      error: {
        message: 'Permission denied',
        code: '42501'
      },
      status: 403
    });

    const result: DeleteResult = await deleteSetlistSong('song123', 'setlist456');

    expect(result.success).toBe(false);
    expect(result.error?.isRLSIssue).toBe(true);
    expect(result.error?.status).toBe(403);
    expect(result.error?.code).toBe('42501');
  });

  it('should handle pre-check errors with proper error details', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        message: 'Database connection failed',
        code: 'PGRST116'
      }
    });

    const result: DeleteResult = await deleteSetlistSong('song123', 'setlist456');

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Pre-check failed');
    expect(result.error?.code).toBe('PGRST116');
    expect(result.error?.isRLSIssue).toBe(true);
    expect(result.error?.status).toBe(500);
  });

  it('should handle exceptions gracefully', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Network error');
    });

    const result: DeleteResult = await deleteSetlistSong('song123', 'setlist456');

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Network error');
    expect(result.error?.code).toBe('EXCEPTION');
    expect(result.error?.status).toBe(500);
  });
});