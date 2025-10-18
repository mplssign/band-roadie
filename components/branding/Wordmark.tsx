import { Sonsie_One } from 'next/font/google';

const sonsieOne = Sonsie_One({ subsets: ['latin'], weight: '400' });

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function Wordmark({ className = '', size = 'md' }: WordmarkProps) {
  return (
    <h1 className={`${sonsieOne.className} ${sizeClasses[size]} font-semibold ${className}`}>
      <span className="text-primary">Band</span>Roadie
    </h1>
  );
}
