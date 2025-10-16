import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditGigBottomDrawer from '@/app/(protected)/dashboard/EditGigBottomDrawer';

// Mock next/navigation useRouter
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

// Mock toast hook
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

test('EditGigBottomDrawer renders gig details when open', () => {
  const gig = {
    id: 'gig-1',
    name: 'Test Gig',
    date: 'Dec 1, 2025',
    time: '7:00 PM - 10:00 PM',
    location: 'The Club',
    setlist: 'Main Set',
  };

  const onClose = jest.fn();

  render(<EditGigBottomDrawer isOpen={true} onClose={onClose} gig={gig} />);

  expect(screen.getByText('Gig Details')).toBeInTheDocument();
  expect(screen.getByText('Test Gig')).toBeInTheDocument();
  expect(screen.getByText('Dec 1, 2025')).toBeInTheDocument();
  expect(screen.getByText('The Club')).toBeInTheDocument();
  expect(screen.getByText('Main Set')).toBeInTheDocument();
});
