'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function EditGigPage() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const gigId = params?.gigId ?? '';
  
  const [gigName, setGigName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isPotential, setIsPotential] = useState(false);
  const [userResponse, setUserResponse] = useState<'yes' | 'no' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGigData();
    // We intentionally only depend on `gigId` here — loadGigData is stable within this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);

  const loadGigData = async () => {
    // TODO: Load actual gig data from API including user's previous response
    if (gigId === 'potential-1') {
      setGigName('Ravinia In Ridgewood');
      setLocation('Western Springs');
      setDate('Fri, Sep 19, 2025');
      setTime('7:00 PM - 9:30 PM');
      setIsPotential(true);
      // TODO: Load user's saved response
      setUserResponse(null); // or 'yes' or 'no' based on saved data
    } else {
      setGigName('SJC Fest');
      setLocation('Western Springs');
      setDate('Sep 14, 2025');
      setTime('6:00 PM - 8:00 PM');
      setIsPotential(false);
    }
    setIsLoading(false);
  };

  const handleResponse = async (response: 'yes' | 'no') => {
    setIsSaving(true);
    try {
      // TODO: API call to save user's response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUserResponse(response);
      showToast(response === 'yes' ? 'Confirmed you can play!' : 'Marked as unavailable', 'success');
    } catch (error) {
      showToast('Failed to save response', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <main className="bg-gray-900 text-white relative z-10">
      <div className="px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {isPotential ? 'Potential Gig' : 'Edit Gig'}
          </h1>
          <p className="text-gray-400 mt-2">
            {isPotential ? 'Review and respond to this gig' : 'View gig details'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Potential Gig Response Section - Only for potential gigs */}
          {isPotential && (
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3">Can you play this gig?</h2>
        <p className="text-gray-300 mb-6">Let your band know if you&apos;re available</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleResponse('yes')}
                  disabled={isSaving}
                  className={`py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    userResponse === 'yes'
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                  }`}
                >
                  <ThumbsUp className="w-6 h-6" />
                  I Can Play
                </button>
                
                <button
                  onClick={() => handleResponse('no')}
                  disabled={isSaving}
                  className={`py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    userResponse === 'no'
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                  }`}
                >
                  <ThumbsDown className="w-6 h-6" />
                  I&apos;m Unavailable
                </button>
              </div>
            </div>
          )}

          {/* Gig Details */}
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Gig Name</label>
              <p className="text-xl font-bold text-white">{gigName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
              <p className="text-lg text-white">{location}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
              <p className="text-lg text-white">{date}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Time</label>
              <p className="text-lg text-white">{time}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={() => router.back()}
              className="w-full py-4 bg-zinc-800 text-gray-300 rounded-xl hover:bg-zinc-700 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
