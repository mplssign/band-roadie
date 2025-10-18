export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  birthday?: string;
  roles?: string[];
  created_at: string;
  updated_at: string;
  profile_completed: boolean;
}

export interface Band {
  id: string;
  name: string;
  image_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
  user?: User;
  band?: Band;
}

export interface Invite {
  id: string;
  band_id: string;
  email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface Rehearsal {
  id: string;
  band_id: string;
  name: string;
  location: string;
  start_time: string;
  end_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Gig {
  id: string;
  band_id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  start_time: string;
  end_time?: string;
  setlist_id?: string;
  is_potential: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Setlist {
  id: string;
  band_id: string;
  name: string;
  songs: Song[];
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  notes?: string;
  order: number;
}

// Tuning types for guitar tunings
export type TuningType = 'standard' | 'drop_d' | 'half_step' | 'full_step';

// Music song interface for search results
export interface MusicSong {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
  album_artwork?: string;
  is_live?: boolean;
}

// Setlist song interface for junction table
export interface SetlistSong {
  id: string;
  setlist_id?: string;
  song_id: string;
  position: number;
  bpm?: number;
  tuning?: TuningType;
  duration_seconds?: number;
  songs?: {
    id: string;
    title: string;
    artist?: string;
    bpm?: number;
    tuning?: TuningType;
    duration_seconds?: number;
    is_live?: boolean;
    album_artwork?: string;
  };
}
