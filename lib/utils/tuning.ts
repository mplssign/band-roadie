import { TuningType } from '@/lib/types';

export interface TuningInfo {
  name: string;
  notes: string;
}

export const tuningMap: Record<TuningType, TuningInfo> = {
  standard: {
    name: 'Standard Tuning',
    notes: 'E A D G B E',
  },
  drop_d: {
    name: 'Drop D',
    notes: 'D A D G B E',
  },
  half_step: {
    name: 'Half Step Down',
    notes: 'Eb Ab Db Gb Bb Eb',
  },
  full_step: {
    name: 'Full Step Down',
    notes: 'D G C F A D',
  },
};

export function getTuningInfo(tuning: TuningType): TuningInfo {
  return tuningMap[tuning] || tuningMap.standard;
}

export function getTuningName(tuning: TuningType): string {
  return getTuningInfo(tuning).name;
}

export function getTuningNotes(tuning: TuningType): string {
  return getTuningInfo(tuning).notes;
}