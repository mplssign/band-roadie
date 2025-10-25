export function formatPhoneNumber(value: string): string {
  const phone = value.replace(/\D/g, '');
  const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

  if (!match) return value;

  const [, area, prefix, line] = match;

  if (line) {
    return `(${area}) ${prefix}-${line}`;
  } else if (prefix) {
    return `(${area}) ${prefix}`;
  } else if (area) {
    return `(${area}`;
  }

  return '';
}

export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 3);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  // Handle time-only strings like "19:00" or "14:30"
  if (typeof date === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(date)) {
    // Parse time string (HH:MM or HH:MM:SS)
    const [hours, minutes] = date.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return 'Time TBD';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatTimeRange(start: string | Date, end: string | Date): string {
  if (!start || !end) return 'Time TBD';
  return `${formatTime(start)} – ${formatTime(end)}`;
}
