import { fireEvent, render, screen, within } from '@testing-library/react';
import { PotentialGigMembersSection } from '@/components/calendar/PotentialGigMembersSection';
import type { BandMemberRecord } from '@/hooks/useBandMembers';
import type { GigMemberResponse } from '@/lib/types';

describe('PotentialGigMembersSection', () => {
    const members: BandMemberRecord[] = [
        {
            id: 'member-1',
            user_id: 'user-1',
            first_name: 'John',
            last_name: 'Smith',
        },
        {
            id: 'member-2',
            user_id: 'user-2',
            first_name: 'John',
            last_name: 'Jones',
        },
        {
            id: 'member-3',
            user_id: 'user-3',
            first_name: 'Emily',
            last_name: 'Stone',
        },
    ];

    const responses: GigMemberResponse[] = [
        {
            band_member_id: 'member-3',
            response: 'yes',
            responded_at: '2024-01-02T10:00:00Z',
        },
    ];

    it('renders member chips and allows toggling optional state', () => {
        const handleToggle = jest.fn();

        render(
            <PotentialGigMembersSection
                members={members}
                optionalMemberIds={['member-2']}
                memberResponses={responses}
                onToggle={handleToggle}
                mode="edit"
            />,
        );

        const johnSmithChip = screen.getByRole('button', { name: 'John S' });
        const johnJonesChip = screen.getByRole('button', { name: 'John J' });
        const emilyChip = screen.getByRole('button', { name: 'Emily' });

        expect(johnSmithChip).toBeInTheDocument();
        expect(johnJonesChip).toBeInTheDocument();
        expect(emilyChip).toBeInTheDocument();

        fireEvent.click(johnSmithChip);
        expect(handleToggle).toHaveBeenCalledWith('member-1');
    });

    it('summarizes responses with optional and not responded groups', () => {
        render(
            <PotentialGigMembersSection
                members={members}
                optionalMemberIds={['member-2']}
                memberResponses={responses}
                onToggle={jest.fn()}
                mode="edit"
            />,
        );

        expect(screen.getByText('Yes')).toBeInTheDocument();
        expect(screen.getByText('Optional')).toBeInTheDocument();
        expect(screen.getByText('Not responded')).toBeInTheDocument();
        const yesGroup = screen.getByText('Yes').parentElement as HTMLElement;
        expect(within(yesGroup).getByText('Emily')).toBeInTheDocument();
    });

    it('falls back to not responded under No when no optional members exist', () => {
        render(
            <PotentialGigMembersSection
                members={members}
                optionalMemberIds={[]}
                memberResponses={[]}
                onToggle={jest.fn()}
                mode="add"
            />,
        );

        expect(screen.getAllByText('Not responded')).toHaveLength(1);
    });
});
