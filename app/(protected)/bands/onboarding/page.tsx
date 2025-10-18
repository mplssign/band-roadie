// app/(protected)/bands/onboarding/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BandsOnboardingPage() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<'create' | 'join' | null>(null);

  const handleCreateBand = () => {
    // TODO: Navigate to create band page
    router.push('/bands/create');
  };

  const handleJoinBand = () => {
    // TODO: Navigate to join band page or show instructions
    router.push('/bands/join');
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Welcome to Band Roadie!</h1>
          <p className="text-xl text-muted-foreground mb-2">Your profile is complete</p>
          <p className="text-muted-foreground">Now let&apos;s get you connected with a band</p>
        </div>

        {/* Options */}
        <div className="space-y-6">
          {/* Create New Band */}
          <div 
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
              selectedOption === 'create' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-border/60 hover:border-border/60'
            }`}
            onClick={() => setSelectedOption('create')}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground mb-2">Create a New Band</h3>
                <p className="text-muted-foreground mb-4">
                  Start fresh with your own band. You&apos;ll be able to invite members, create setlists, 
                  and manage rehearsals and gigs.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Set up band name and info</li>
                  <li>• Invite other musicians via email</li>
                  <li>• Become the band admin</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Join Existing Band */}
          <div 
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
              selectedOption === 'join' 
                ? 'border-green-500 bg-green-500/10' 
                : 'border-border/60 hover:border-border/60'
            }`}
            onClick={() => setSelectedOption('join')}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.196-2.121M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.196-2.121M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground mb-2">Join an Existing Band</h3>
                <p className="text-muted-foreground mb-4">
                  Already part of a band? Get an invitation from your bandmates to join their 
                  Band Roadie workspace.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Ask a bandmate to invite you</li>
                  <li>• Access shared setlists and schedules</li>
                  <li>• View band member contact info</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-8">
          {selectedOption === 'create' && (
            <button
              onClick={handleCreateBand}
              className="w-full py-4 bg-primary hover:bg-primary/90 text-foreground text-lg font-medium rounded-lg transition-colors"
            >
              Create New Band
            </button>
          )}
          
          {selectedOption === 'join' && (
            <button
              onClick={handleJoinBand}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-foreground text-lg font-medium rounded-lg transition-colors"
            >
              Join Existing Band
            </button>
          )}

          {!selectedOption && (
            <p className="text-center text-muted-foreground text-sm">
              Select an option above to continue
            </p>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center pt-8 border-t border-border/70">
          <p className="text-muted-foreground text-sm mb-2">
            Not sure which option to choose?
          </p>
          <p className="text-muted-foreground text-sm">
            If you&apos;re starting a new band or the first person from your band to use Band Roadie, 
            choose Create a New Band. If your bandmates are already using Band Roadie, 
            choose Join Existing Band.
          </p>
        </div>
      </div>
    </main>
  );
}