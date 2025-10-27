'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Upload, ArrowLeft, Zap } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { createClient } from '@/lib/supabase/client';

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

type MemberResponse = {
  user_id: string;
  role?: string | null;
  users?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

function getBandInitials(name: string): string {
  if (!name.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 3); // Limit to 3 characters max to match TopNav
}

function getFontSize(initialsLength: number): string {
  if (initialsLength <= 2) return '28px';
  if (initialsLength === 3) return '24px';
  if (initialsLength === 4) return '20px';
  if (initialsLength === 5) return '18px';
  if (initialsLength === 6) return '16px';
  return '14px';
}

export default function EditBandPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { showToast } = useToast();
  const bandId = params?.bandId;
  
  const [bandName, setBandName] = useState('');
  const [bandImage, setBandImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('bg-rose-600');
  const [emailInput, setEmailInput] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [initialInviteEmails, setInitialInviteEmails] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bandMembers, setBandMembers] = useState<MemberResponse[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<MemberResponse | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [initialBandState, setInitialBandState] = useState<{
    bandName: string;
    selectedColor: string;
    imagePreview: string | null;
    inviteEmails: string[];
    hasNewImage: boolean;
  } | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [pendingNavigationIsBack, setPendingNavigationIsBack] = useState(false);
  const ignorePopStateRef = useRef(false);

  const currentBandState = useMemo(
    () => ({
      bandName: bandName.trim(),
      selectedColor,
      imagePreview,
      inviteEmails: [...inviteEmails].map((email) => email.toLowerCase()).sort(),
      hasNewImage: !!bandImage,
    }),
    [bandName, selectedColor, imagePreview, inviteEmails, bandImage],
  );

  const isDirty = useMemo(() => {
    if (!initialBandState) return false;
    return (
      initialBandState.bandName !== currentBandState.bandName ||
      initialBandState.selectedColor !== currentBandState.selectedColor ||
      initialBandState.imagePreview !== currentBandState.imagePreview ||
      initialBandState.hasNewImage !== currentBandState.hasNewImage ||
      initialBandState.inviteEmails.join('|') !== currentBandState.inviteEmails.join('|')
    );
  }, [initialBandState, currentBandState]);

  const loadBandData = useCallback(async () => {
    if (!bandId) return;
    try {
      const { data: band } = await supabase
        .from('bands')
        .select('*')
        .eq('id', bandId)
        .single();

      if (band) {
        setBandName(band.name);
        const sanitizedColor =
          band.avatar_color && VALID_AVATAR_COLORS.has(band.avatar_color)
            ? band.avatar_color
            : 'bg-rose-600';
        setSelectedColor(sanitizedColor);
        setImagePreview(band.image_url ?? null);
        setBandImage(null);
        
        // fetch invites first, then set initial state once
        try {
          const res = await fetch(`/api/bands/${bandId}`);
          if (res.ok) {
            const data = await res.json();
            const invited = Array.isArray(data?.invites)
              ? data.invites
                  .map((inv: { email?: string | null }) => inv?.email)
                  .filter((email): email is string => Boolean(email))
              : [];
            const normalizedInvites = invited.map((email) => email.toLowerCase());
            const sortedInvites = [...normalizedInvites].sort();
            setInviteEmails(sortedInvites);
            setInitialInviteEmails([...sortedInvites]);
            setBandMembers(Array.isArray(data?.members) ? data.members : []);
            
            // Set initial state only once with all data loaded
            setInitialBandState({
              bandName: band.name.trim(),
              selectedColor: sanitizedColor,
              imagePreview: band.image_url ?? null,
              inviteEmails: [...sortedInvites],
              hasNewImage: false,
            });
          } else {
            // If invites fetch fails, still set initial state with empty invites
            setInitialBandState({
              bandName: band.name.trim(),
              selectedColor: sanitizedColor,
              imagePreview: band.image_url ?? null,
              inviteEmails: [],
              hasNewImage: false,
            });
          }
        } catch (err) {
          // If invites fetch fails, still set initial state with empty invites
          setInitialBandState({
            bandName: band.name.trim(),
            selectedColor: sanitizedColor,
            imagePreview: band.image_url ?? null,
            inviteEmails: [],
            hasNewImage: false,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load band data:', error);
      showToast('Failed to load band data', 'error');
    }
  }, [supabase, bandId, showToast]);

  useEffect(() => {
    loadBandData();
  }, [loadBandData]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (!isMounted) return;
        setCurrentUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentUserId(null);
      });
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (ignorePopStateRef.current) {
        ignorePopStateRef.current = false;
        return;
      }
      if (!isDirty) return;
      if (showUnsavedDialog) {
        window.history.pushState(null, '', window.location.href);
        return;
      }
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setPendingNavigation(() => () => router.back());
      setPendingNavigationIsBack(true);
      setShowUnsavedDialog(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty, router, showUnsavedDialog]);

  

  const handleBandNameChange = (value: string) => {
    const capitalized = value
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    setBandName(capitalized);
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
      const formData = new FormData();
      formData.append('name', bandName.trim());
      const avatarColor = VALID_AVATAR_COLORS.has(selectedColor)
        ? selectedColor
        : 'bg-rose-600';
      formData.append('avatarColor', avatarColor);
      
      if (bandImage) {
        formData.append('image', bandImage);
      }
      
      const response = await fetch(`/api/bands/${bandId}`, {
        method: 'PATCH',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update band');
      }

      const newInvites = inviteEmails.filter((email) => !initialInviteEmails.includes(email));
      let invitesFailedMessage: string | null = null;

      if (newInvites.length > 0) {
        const inviteResponse = await fetch(`/api/bands/${bandId}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: newInvites }),
        });

        const inviteData: {
          failedInvites?: { email: string; error: string }[];
          error?: string;
        } | null = await inviteResponse.json().catch(() => null);

        const failed = Array.isArray(inviteData?.failedInvites) ? inviteData?.failedInvites : [];

        if (!inviteResponse.ok || failed.length > 0) {
          const details = failed.length
            ? failed.map((item) => `${item.email}: ${item.error}`).join('; ')
            : null;
          invitesFailedMessage =
            (inviteData?.error && details ? `${inviteData.error} — ${details}` : inviteData?.error || details) ??
            'Failed to send some invites';
          showToast(invitesFailedMessage, 'error');
        } else {
          showToast('Invites sent!', 'success');
        }
      }

      // Reload band data to get updated state
      await loadBandData();

      if (!invitesFailedMessage && newInvites.length > 0) {
        setInitialInviteEmails((prev) => Array.from(new Set([...prev, ...newInvites])));
      }

      if (invitesFailedMessage) {
        setErrors({ general: invitesFailedMessage });
        setIsLoading(false);
        return;
      }

      showToast('Band updated successfully!', 'success');
      
      // Reset form state after successful update to mark as clean
      setIsLoading(false);
      
      // Use router.push instead of setTimeout for more reliable navigation
      router.push('/dashboard');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update band. Please try again.';
      setErrors({ general: errorMessage });
      showToast(errorMessage, 'error');
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    const trimmed = value.trim();
    const matched = EMAIL_DOMAINS.find((domain) => trimmed.endsWith(`@${domain}`));
    setSelectedDomain(matched ?? null);
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

  const addEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      return;
    }

    if (inviteEmails.includes(trimmedEmail)) {
      setErrors((prev) => ({ ...prev, email: 'This email is already in the list' }));
      return;
    }

    setInviteEmails((prev) => [...prev, trimmedEmail].sort());
    setEmailInput('');
    setSelectedDomain(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      return next;
    });
  };

  const removeEmail = async (emailToRemove: string) => {
    try {
      const response = await fetch(`/api/bands/${bandId}/invites`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToRemove }),
      });

      if (!response.ok) {
        console.error('Failed to remove invitation');
        return;
      }

      // Only update the frontend state if the API call was successful
      setInviteEmails((prev) => prev.filter((email) => email !== emailToRemove));
    } catch (error) {
      console.error('Error removing invitation:', error);
    }
  };

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const attemptNavigation = (navFn: () => void, options?: { isBack?: boolean }) => {
    if (isDirty) {
      setPendingNavigation(() => navFn);
      setPendingNavigationIsBack(Boolean(options?.isBack));
      setShowUnsavedDialog(true);
    } else {
      navFn();
    }
  };

  const cancelNavigation = () => {
    setPendingNavigation(null);
    setPendingNavigationIsBack(false);
    setShowUnsavedDialog(false);
  };

  const confirmNavigation = () => {
    const next = pendingNavigation;
    const isBack = pendingNavigationIsBack;
    setPendingNavigation(null);
    setPendingNavigationIsBack(false);
    setShowUnsavedDialog(false);
    if (next) {
      if (isBack) {
        ignorePopStateRef.current = true;
      }
      next();
    }
  };

  const getMemberName = (member: MemberResponse): string => {
    const first = member.users?.first_name?.trim() ?? '';
    const last = member.users?.last_name?.trim() ?? '';
    const name = `${first} ${last}`.trim();
    return name || member.users?.email || 'Member';
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      const isSelf = currentUserId && memberToRemove.user_id === currentUserId;
      const res = await fetch(`/api/bands/${bandId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberToRemove.user_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove member');
      }
      setBandMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id));
      setMemberToRemove(null);
      if (isSelf) {
        showToast('You left the band', 'success');
        router.push('/dashboard');
        return;
      }
      showToast('Member removed', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      showToast(message, 'error');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/bands/${bandId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete band');
      }
      
      showToast('Band deleted successfully', 'success');
      router.push('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete band';
      console.error('Failed to delete band:', error);
      showToast(errorMessage, 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const initials = getBandInitials(bandName);
  const fontSize = getFontSize(initials.length);

  return (
    <main className="bg-background text-foreground relative z-10">
      <div className="px-4 pt-4">
        <button
          onClick={() => attemptNavigation(() => router.back(), { isBack: true })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Edit Band</h1>
          <p className="text-muted-foreground mt-2">Update your band information</p>
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
              onChange={(e) => handleBandNameChange(e.target.value)}
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
                    <img
                      src={imagePreview}
                      alt="Band preview"
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        console.log('Edit page: Image failed to load, showing initials');
                        // If image fails to load, clear the preview to show initials
                        setImagePreview(null);
                      }}
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
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-foreground ${selectedColor}`}
                  >
                    {initials ? (
                      <span
                        className="font-semibold tracking-wide"
                        style={{ fontSize }}
                      >
                        {initials}
                      </span>
                    ) : (
                      <Zap className="h-10 w-10" />
                    )}
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
                disabled={!emailInput.trim()}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
                      isEnabled ? 'hover:bg-muted/60 hover:text-foreground' : 'opacity-50 cursor-not-allowed'
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

          {/* Current Members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Current Members
            </label>
            {bandMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members found for this band.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bandMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-foreground"
                  >
                    <span>{getMemberName(member)}</span>
                    <button
                      type="button"
                      onClick={() => setMemberToRemove(member)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                      aria-label={
                        member.user_id === currentUserId
                          ? 'Leave band'
                          : `Remove ${getMemberName(member)}`
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !bandName.trim() || !isDirty}
              className={`w-full py-4 rounded-lg text-lg font-medium transition-colors ${
                !isLoading && bandName.trim() && isDirty
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                  : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Updating Band...' : 'Update Band'}
            </button>
            
            <button
              onClick={() => attemptNavigation(() => router.back(), { isBack: true })}
              disabled={isLoading}
              className="w-full py-4 bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/40 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading}
              className="w-full text-rose-500 hover:text-rose-400 transition-colors text-center py-2 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-6 shadow-xl">
            <h3 className="text-xl font-bold text-foreground mb-4">Delete Band</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this band? This action cannot be undone and will remove all associated data including gigs, rehearsals, and setlists.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-muted/40 text-muted-foreground rounded-lg hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/80 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Dialog */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-6 shadow-xl">
            <h3 className="text-xl font-bold text-foreground mb-3">
              {memberToRemove.user_id === currentUserId ? 'Leave Band' : 'Remove Member'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {memberToRemove.user_id === currentUserId ? (
                <>
                  Are you sure you want to leave{' '}
                  <span className="font-semibold text-foreground">{bandName || 'this band'}</span>? You’ll lose
                  access to its setlists, events, and members.
                </>
              ) : (
                <>
                  Are you sure you want to remove{' '}
                  <span className="font-semibold text-foreground">{getMemberName(memberToRemove)}</span> from this
                  band?
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                disabled={removingMember}
                className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removingMember}
                className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/80 disabled:opacity-50"
              >
                {removingMember
                  ? memberToRemove.user_id === currentUserId
                    ? 'Leaving...'
                    : 'Removing...'
                  : memberToRemove.user_id === currentUserId
                    ? 'Leave'
                    : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl shadow-primary/20">
            <h3 className="text-xl font-semibold text-foreground">Discard changes?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You have unsaved changes. Are you sure you want to leave without saving?
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={cancelNavigation}
                className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmNavigation}
                className="w-full rounded-lg py-3 text-base font-semibold text-rose-500 transition-colors hover:text-rose-400"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
