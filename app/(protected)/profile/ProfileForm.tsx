'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { Wordmark } from '@/components/branding/Wordmark';

import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { User } from '@/lib/types';

const ROLE_OPTIONS = [
  'Lead Vocals',
  'Guitar',
  'Bass',
  'Drums',
  'Keyboard',
  'Piano',
  'Sound',
  'DJ',
  'Backing Vocals',
  'Lead Guitar',
  'Rythem Guitar',
  'Percussion',
  'Acoustic Guitar',
] as const;
const MONTH_OPTIONS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'] as const;
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

const normalizeRoles = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === 'string' && role.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((role): role is string => typeof role === 'string' && role.trim().length > 0);
      }
    } catch {
      // fall through to handle non-JSON formats
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((role) => role.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [];
};

const capitalizeWords = (value: string) => {
  return value
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

interface InvitationDetails { bands: { name: string } }

type ProfileSnapshot = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  zip: string;
  birthMonth: string;
  birthDay: string;
  roles: string[];
};

interface ProfileFormProps {
  user: (User & { phone?: string | null; address?: string | null; zip?: string | null; birthday?: string | null; roles?: string[] | null; }) | null;
  invitationId?: string;
  invitation?: InvitationDetails | null;
}

const ProfileForm = ({ user, invitationId: _invitationId, invitation }: ProfileFormProps) => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<{ show: boolean; role?: string } | null>(null);
  const [initialState, setInitialState] = useState<ProfileSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  // Basic focus trap: when modal opens, trap Tab within modal
  useEffect(() => {
    if (!showAddRoleModal || !modalRef.current) return;
    const root = modalRef.current;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showAddRoleModal]);


  useEffect(() => {
    const defaultSnapshot: ProfileSnapshot = {
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      zip: '',
      birthMonth: '',
      birthDay: '',
      roles: [],
    };

    if (!user) {
      setFirstName('');
      setLastName('');
      setPhone('');
      setAddress('');
      setZip('');
      setBirthMonth('');
      setBirthDay('');
      setSelectedRoles([]);
      setInitialState(defaultSnapshot);
      return;
    }

    const derivedFirstName = user.first_name || '';
    const derivedLastName = user.last_name || '';
    const formattedPhone = formatPhoneNumber(user.phone || '');
    const derivedAddress = user.address || '';
    const derivedZip = user.zip || '';

    let monthValue = '';
    let dayValue = '';
    if (user.birthday) {
      const parts = user.birthday.split('-');
      const monthPart = parts[1];
      const dayPart = parts[2];

      if (monthPart) {
        const monthIndex = Number.parseInt(monthPart, 10) - 1;
        if (!Number.isNaN(monthIndex) && monthIndex >= 0 && monthIndex < MONTH_OPTIONS.length) {
          monthValue = MONTH_OPTIONS[monthIndex];
        }
      }

      if (dayPart) {
        const numericDay = Number.parseInt(dayPart, 10);
        if (!Number.isNaN(numericDay)) {
          dayValue = numericDay.toString();
        }
      }
    }

    const roles = normalizeRoles(user.roles);

    setFirstName(derivedFirstName);
    setLastName(derivedLastName);
    setPhone(formattedPhone);
    setAddress(derivedAddress);
    setZip(derivedZip);
    setBirthMonth(monthValue);
    setBirthDay(dayValue);
    setSelectedRoles(roles);

    setInitialState({
      firstName: derivedFirstName,
      lastName: derivedLastName,
      phone: formattedPhone,
      address: derivedAddress,
      zip: derivedZip,
      birthMonth: monthValue,
      birthDay: dayValue,
      roles,
    });
  }, [user]);

  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length === 0) return '';
    if (phone.length <= 3) return `(${phone}`;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // Returns true when a new custom role was successfully added, false otherwise
  const handleAddCustomRole = async (): Promise<boolean> => {
    if (addingRole) return false;
    const candidate = customRoleInput.trim();
    if (!candidate) return false;
    const lower = candidate.toLowerCase();
    const existsInDefaults = ROLE_OPTIONS.some(r => r.toLowerCase() === lower);
    const existsInCustom = customRoles.some(r => r.toLowerCase() === lower);
    const existsInSelected = selectedRoles.some(r => r.toLowerCase() === lower);
    if (existsInDefaults || existsInCustom || existsInSelected) {
      setShowDuplicateModal({ show: true, role: candidate });
      return false;
    }

  setAddingRole(true);
  // Optimistically update UI
    const prevCustom = [...customRoles];
    const prevSelected = [...selectedRoles];
    const newCustom = [candidate, ...prevCustom];
    const newSelected = [candidate, ...prevSelected];
    setCustomRoles(newCustom);
    setSelectedRoles(newSelected);
    setCustomRoleInput('');

    // Persist updated profile (roles) to server. We send current profile fields to avoid clobbering.
    try {
      // Persist the role globally first
      try {
        const roleResp = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: candidate }),
        });

        if (!roleResp.ok) {
          // Non-fatal: continue and let profile persistence handle rollback
          console.warn('Failed to create global role');
        }
      } catch (err) {
        console.warn('Failed to create global role', err);
      }
      // compute birthday in same format as handleSubmit (using 1970 as stable dummy year)
      let birthdayDate: string | null = null;
      if (birthMonth && birthDay) {
        const monthIndex = MONTH_OPTIONS.findIndex((m) => m === birthMonth);
        if (monthIndex >= 0) {
          birthdayDate = `1970-${String(monthIndex + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
        }
      }

      const resp = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone.replace(/\D/g, ''),
          address,
          zip,
          birthday: birthdayDate,
          roles: newSelected,
        }),
      });

      if (!resp.ok) {
        // rollback optimistic update
        setCustomRoles(prevCustom);
        setSelectedRoles(prevSelected);
        const data = await resp.json().catch(() => ({}));
        setError((data && data.error) || 'Failed to save custom role');
        setAddingRole(false);
        showToast('Failed to save custom role', 'error');
        return false;
      }
      setAddingRole(false);
      showToast('Custom role added', 'success');
      return true;
    } catch (err) {
      setCustomRoles(prevCustom);
      setSelectedRoles(prevSelected);
      setError('Failed to save custom role. Please try again.');
      setAddingRole(false);
      showToast('Failed to save custom role', 'error');
      return false;
    }
  };

  const getBirthdayDisplay = () => {
    if (birthMonth && birthDay) {
      return `${birthMonth} ${birthDay}`;
    }
    return 'Not set';
  };

  const hasChanges = useMemo(() => {
    if (!initialState) {
      return false;
    }

    const sortedInitialRoles = [...initialState.roles].sort();
    const sortedCurrentRoles = [...selectedRoles].sort();
    const rolesEqual =
      sortedInitialRoles.length === sortedCurrentRoles.length &&
      sortedInitialRoles.every((role, index) => role === sortedCurrentRoles[index]);

    return (
      initialState.firstName !== firstName ||
      initialState.lastName !== lastName ||
      initialState.phone !== phone ||
      initialState.address !== address ||
      initialState.zip !== zip ||
      initialState.birthMonth !== birthMonth ||
      initialState.birthDay !== birthDay ||
      !rolesEqual
    );
  }, [initialState, firstName, lastName, phone, address, zip, birthMonth, birthDay, selectedRoles]);

  const isSubmitDisabled = isLoading || !hasChanges;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName || !lastName || !phone || !address || !zip || selectedRoles.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      // Convert month/day to date format (using 1970 as stable dummy year to avoid timezone issues)
      let birthdayDate: string | null = null;
      if (birthMonth && birthDay) {
        const monthIndex = MONTH_OPTIONS.findIndex((m) => m === birthMonth);
        if (monthIndex >= 0) {
          birthdayDate = `1970-${String(monthIndex + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
        }
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone.replace(/\D/g, ''),
          address,
          zip,
          birthday: birthdayDate,
          roles: selectedRoles
        })
      });

      if (!response.ok) throw new Error('Failed to update profile');

      // Profile completed successfully - redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="bg-background pb-20 text-foreground overflow-x-hidden">
      {/* local scrollbar hider for non-Radix areas */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />

      <div className="px-4 pt-4">
        {/* App Name Header - only show for new users */}
        {(!user?.first_name || !user?.last_name) && (
          <div className="mb-8 text-center">
            <Wordmark className="text-foreground inline-block" />
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-3xl font-bold">My Profile</h2>
          <p className="mt-2 text-muted-foreground">Update your personal information</p>
        </div>

        {invitation && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/10 p-4">
            <p className="text-primary">
              You&rsquo;ve been invited to join <strong className="text-foreground">{invitation.bands.name}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/60 bg-destructive/10 p-4 text-destructive-foreground">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">
                First Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">
                Last Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none text-muted-foreground">
              Phone Number <span className="text-destructive">*</span>
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(123) 456-7890"
              className="h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">
                Address <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground">
                Zip Code <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={5}
                className="h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Birthday</label>
              <span className="text-sm font-semibold text-primary">{getBirthdayDisplay()}</span>
            </div>

            <div className="flex gap-6">
              {/* Left spacer to maintain layout */}
              <div className="hidden w-32 flex-shrink-0 items-center justify-center sm:flex" />

              {/* Right: selectors */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Month */}
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Month</p>
                  <ScrollArea className="w-full">
                    <ToggleGroup
                      type="single"
                      value={birthMonth ?? ''}
                      onValueChange={(v) => setBirthMonth(v ?? '')}
                      className="flex w-max gap-2 pr-2"
                      aria-label="Select birth month"
                    >
                      {MONTH_OPTIONS.map((m) => (
                        <ToggleGroupItem
                          key={m}
                          value={m}
                          variant="outline"
                          className="px-4 py-2 rounded-full font-medium shrink-0"
                        >
                          {m}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>

                {/* Day */}
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Day</p>
                  <ScrollArea className="w-full">
                    <ToggleGroup
                      type="single"
                      value={birthDay ?? ''}
                      onValueChange={(v) => setBirthDay(v ?? '')}
                      className="flex w-max gap-2 pr-2"
                      aria-label="Select birth day"
                    >
                      {DAY_OPTIONS.map((d) => (
                        <ToggleGroupItem
                          key={d}
                          value={d}
                          variant="outline"
                          className="h-12 w-12 rounded-full font-medium shrink-0 flex items-center justify-center"
                        >
                          {d}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>

          {/* Roles (kept as chips; add horizontal container guard) */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Role in Band <span className="text-destructive">*</span>
            </label>
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar touch-pan-x max-w-full items-center">
              {/* + Add control (opens modal) */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCustomRoleInput('');
                    setShowAddRoleModal(true);
                  }}
                  className="px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 bg-muted/40 text-muted-foreground hover:bg-muted/50"
                >
                  + Add
                </button>
              </div>

              {customRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedRoles.includes(role)
                      ? 'bg-primary text-primary-foreground shadow shadow-primary/40'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {role}
                </button>
              ))}

              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedRoles.includes(role)
                      ? 'bg-primary text-primary-foreground shadow shadow-primary/40'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Add Role Modal (Radix Dialog) */}
          <Dialog.Root open={showAddRoleModal} onOpenChange={(open) => setShowAddRoleModal(open)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-md w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 focus:outline-none">
                <Dialog.Title className="text-lg font-semibold">Add custom role</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">Enter a custom role to add to your roles list.</Dialog.Description>
                <div className="mt-4">
                  <Input
                    type="text"
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(capitalizeWords(e.target.value))}
                    onKeyDown={(e) => {
                      if (addingRole) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomRole().then((added) => {
                          if (added) setShowAddRoleModal(false);
                        });
                      }
                    }}
                    placeholder="e.g. Rhythm Guitar"
                    className="w-full h-10 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <Dialog.Close asChild>
                    <button
                      onClick={() => setCustomRoleInput('')}
                      className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={() => {
                      if (addingRole) return;
                      handleAddCustomRole().then((added) => {
                        if (added) setShowAddRoleModal(false);
                      });
                    }}
                    disabled={addingRole}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground ${addingRole ? 'bg-muted/40' : 'bg-primary'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {addingRole && (
                        <svg className="animate-spin h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      )}
                      <span>{addingRole ? 'Adding...' : 'Add'}</span>
                    </div>
                  </button>
                </div>
                <Dialog.Close />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {showDuplicateModal?.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-lg bg-card p-6">
                <h3 className="text-lg font-semibold">Role already exists</h3>
                <p className="mt-2 text-sm text-muted-foreground">{showDuplicateModal.role} already exists.</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowDuplicateModal(null)}
                    className="flex-1 rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`w-full rounded-lg py-4 text-lg font-medium transition-opacity ${
              isSubmitDisabled
                ? 'cursor-not-allowed bg-muted/40 text-muted-foreground'
                : 'bg-primary text-primary-foreground shadow shadow-primary/30 hover:opacity-90'
            }`}
          >
            {isLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};
export default ProfileForm;

// Named exports for testing/helpers
export { capitalizeWords };
