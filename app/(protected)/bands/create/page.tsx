'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, ArrowLeft, Zap } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/lib/supabase/client';
import { useBands } from '@/contexts/BandsContext';

const TAILWIND_COLORS = [
  { name: 'Red', class: 'bg-red-600' },
  { name: 'Orange', class: 'bg-orange-600' },
  { name: 'Amber', class: 'bg-amber-600' },
  { name: 'Yellow', class: 'bg-yellow-600' },
  { name: 'Lime', class: 'bg-lime-600' },
  { name: 'Green', class: 'bg-green-600' },
  { name: 'Emerald', class: 'bg-emerald-600' },
  { name: 'Teal', class: 'bg-teal-600' },
  { name: 'Cyan', class: 'bg-cyan-600' },
  { name: 'Sky', class: 'bg-sky-600' },
  { name: 'Blue', class: 'bg-blue-600' },
  { name: 'Indigo', class: 'bg-indigo-600' },
  { name: 'Violet', class: 'bg-violet-600' },
  { name: 'Purple', class: 'bg-purple-600' },
  { name: 'Fuchsia', class: 'bg-fuchsia-600' },
  { name: 'Pink', class: 'bg-pink-600' },
  { name: 'Rose', class: 'bg-rose-600' },
];

const VALID_AVATAR_COLORS = new Set(TAILWIND_COLORS.map((color) => color.class));

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'icloud.com', 'outlook.com'];



export default function CreateBandPage() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const { refreshBands } = useBands();
  
  const [bandName, setBandName] = useState('');
  const [bandImage, setBandImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('bg-rose-600');
  const [emailInput, setEmailInput] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBandNameChange = (value: string) => {
    const capitalized = value
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    setBandName(capitalized);
  };

  // Generate initials from band name
  const getBandInitials = (name: string): string => {
    if (!name.trim()) return '';
    
    const words = name.trim().split(' ').filter(word => word.length > 0);
    if (words.length === 0) return '';
    
    if (words.length === 1) {
      // Single word: take first two characters
      return words[0].slice(0, 2).toUpperCase();
    } else {
      // Multiple words: take first character of first two words
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, image: 'Image must be less than 5MB' });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, image: 'File must be an image' });
        return;
      }

      setBandImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      const newErrors = { ...errors };
      delete newErrors.image;
      setErrors(newErrors);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const appendDomain = (domain: string) => {
    setSelectedDomain((prevSelected) => {
      if (prevSelected === domain) {
        setEmailInput((prevInput) => {
          const trimmed = prevInput.trim();
          if (!trimmed) return '';
          if (trimmed === `@${domain}`) return '';
          if (trimmed.endsWith(`@${domain}`)) {
            const base = trimmed.slice(0, -(`@${domain}`).length);
            return base.trim();
          }
          return trimmed;
        });
        return null;
      }

      setEmailInput((prevInput) => {
        const trimmed = prevInput.trim();
        const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
        const sanitized = base.replace(/\s+/g, '');
        return sanitized ? `${sanitized}@${domain}` : `@${domain}`;
      });

      return domain;
    });
  };

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    const trimmed = value.trim();
    const matched = EMAIL_DOMAINS.find((domain) => trimmed.endsWith(`@${domain}`));
    setSelectedDomain(matched ?? null);
  };

  const addEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase();
    
    if (!trimmedEmail) return;
    
    if (!isValidEmail(trimmedEmail)) {
      setErrors({ ...errors, email: 'Please enter a valid email address' });
      return;
    }
    
    if (inviteEmails.includes(trimmedEmail)) {
      setErrors({ ...errors, email: 'This email is already in the list' });
      return;
    }
    
    setInviteEmails([...inviteEmails, trimmedEmail]);
    setSelectedDomain(null);
    setEmailInput('');
    
    const newErrors = { ...errors };
    delete newErrors.email;
    setErrors(newErrors);
  };

  const removeEmail = (emailToRemove: string) => {
    setInviteEmails(inviteEmails.filter(email => email !== emailToRemove));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!bandName.trim()) {
      newErrors.bandName = 'Band name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('name', bandName.trim());
      const avatarColor = VALID_AVATAR_COLORS.has(selectedColor)
        ? selectedColor
        : 'bg-rose-600';
      formData.append('avatarColor', avatarColor);
      formData.append('createdBy', user.id);
      formData.append('inviteEmails', JSON.stringify(inviteEmails));
      
      if (bandImage) {
        formData.append('image', bandImage);
      }
      
      const response = await fetch('/api/bands/create', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create band');
      }

      showToast('Band created successfully!', 'success');
      
      // Refresh bands to update the hook with new band
      refreshBands();
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create band. Please try again.';
      setErrors({ general: errorMessage });
      showToast(errorMessage, 'error');
      setIsLoading(false);
    }
  };

  // initials intentionally not used (avatar uses Zap icon or uploaded image)

  return (
    <main className="bg-background text-foreground relative z-10">
      <div className="px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create New Band</h1>
          <p className="text-muted-foreground mt-2">Set up your band and invite members</p>
        </div>

        <div className="space-y-8">
          {errors.general && (
            <div className="bg-destructive/10 border border-destructive/60 text-destructive px-4 py-3 rounded-lg">
              {errors.general}
            </div>
          )}

          {/* Band Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Band Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter band name"
              value={bandName}
              onChange={e => handleBandNameChange(e.target.value)}
              className={`w-full rounded-lg border border-border/60 bg-zinc-900 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.bandName ? 'ring-2 ring-destructive' : ''
              }`}
            />
            {errors.bandName && (
              <p className="text-destructive-foreground text-sm mt-1">{errors.bandName}</p>
            )}
          </div>

          {/* Band Avatar */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-4">
              Band Avatar
            </label>
            
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden">
                    <Image
                      src={imagePreview}
                      alt="Band preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => {
                        setBandImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center hover:bg-destructive/80"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-2xl ${selectedColor}`}
                  >
                    {getBandInitials(bandName) || <Zap className="h-10 w-10" />}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                  <div className="flex gap-2 py-2">
                    <label className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer transition-colors hover:border-primary/60">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                        ref={fileInputRef}
                      />
                    </label>
                    {TAILWIND_COLORS.map((color) => (
                      <button
                        key={color.class}
                        type="button"
                          onClick={() => {
                            setSelectedColor(color.class);
                            setBandImage(null);
                            setImagePreview(null);
                          }}
                          className={`flex-shrink-0 h-12 w-12 rounded-full ${color.class} transition-all ${
                            selectedColor === color.class && !imagePreview
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110'
                              : 'hover:scale-105'
                          }`}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Upload an image or choose a color for your band avatar
                </p>
              </div>
            </div>

            {errors.image && (
              <p className="text-destructive-foreground text-sm mt-2">{errors.image}</p>
            )}
          </div>

          {/* Invite Members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Invite Members
            </label>
            <p className="text-sm text-muted-foreground mb-4">
              Add email addresses to invite members to your band
            </p>

            {inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40/50 rounded-lg">
                {inviteEmails.map(email => (
                  <div
                    key={email}
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-primary text-primary-foreground"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="hover:bg-primary/90 rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3 flex gap-2">
              <input
                type="email"
                placeholder="name@example.com"
                value={emailInput}
                onChange={e => handleEmailInputChange(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                className={`flex-1 rounded-lg border px-4 py-3 bg-zinc-900 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? 'border-destructive' : 'border-border/60'}`}
              />
              <button
                type="button"
                onClick={addEmail}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Add
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {EMAIL_DOMAINS.map(domain => {
                const isSelected = selectedDomain === domain;
                const isEnabled = emailInput.trim().length > 0;
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => appendDomain(domain)}
                    disabled={!isEnabled}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      isSelected
                        ? 'border-2 border-primary bg-primary/20 text-primary hover:bg-primary/30'
                        : 'border border-border/60 bg-muted/40 text-muted-foreground'
                    } ${
                      isEnabled
                        ? 'hover:bg-muted/60 hover:text-foreground'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    @{domain}
                  </button>
                );
              })}
            </div>
            
            {errors.email && (
              <p className="text-destructive-foreground text-sm mt-2">{errors.email}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !bandName.trim()}
              className={`w-full py-4 rounded-lg text-lg font-medium transition-colors ${
                !isLoading && bandName.trim()
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                  : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Creating Band...' : 'Create Band'}
            </button>
            
            <button
              onClick={() => router.back()}
              disabled={isLoading}
              className="w-full rounded-lg bg-muted/40 py-4 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
