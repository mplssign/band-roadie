'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GigMemberResponse } from '@/lib/types';
import type { BandMemberRecord } from '@/hooks/useBandMembers';
import {
    buildMemberLabelMap,
    summarizeGigResponses,
    type LabeledMember,
} from '@/lib/utils/potential-gigs';

type DrawerMode = 'add' | 'edit';

interface PotentialGigMembersSectionProps {
    members: BandMemberRecord[];
    optionalMemberIds: string[];
    memberResponses?: GigMemberResponse[];
    onToggle: (memberId: string) => void;
    loading?: boolean;
    error?: Error | null;
    mode: DrawerMode;
}

function MemberStatusGroup({
    title,
    members,
    emptyLabel,
    accent,
}: {
    title: string;
    members: LabeledMember[];
    emptyLabel?: string;
    accent?: 'positive' | 'negative' | 'neutral';
}) {
    const accentClass =
        accent === 'positive'
            ? 'text-emerald-300'
            : accent === 'negative'
                ? 'text-rose-300'
                : 'text-foreground/70';

    return (
        <div className="space-y-2 min-w-[160px]">
            <div className={cn('text-xs font-semibold uppercase tracking-wide', accentClass)}>{title}</div>
            {members.length > 0 ? (
                <ul className="flex flex-wrap gap-2 text-sm">
                    {members.map((member) => (
                        <li key={member.id} className="rounded-full bg-muted/60 px-3 py-1 text-foreground">
                            {member.label}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-sm text-muted-foreground">{emptyLabel ?? 'No members'}</div>
            )}
        </div>
    );
}

export function PotentialGigMembersSection({
    members,
    optionalMemberIds,
    memberResponses = [],
    onToggle,
    loading = false,
    error = null,
    mode,
}: PotentialGigMembersSectionProps) {
    const optionalSet = useMemo(() => new Set(optionalMemberIds), [optionalMemberIds]);

    const memberInfos = useMemo(
        () =>
            members.map((member) => ({
                id: member.id,
                first_name: member.first_name ?? null,
                last_name: member.last_name ?? null,
            })),
        [members],
    );

    const labelMap = useMemo(
        () => buildMemberLabelMap(memberInfos, memberResponses, optionalMemberIds),
        [memberInfos, memberResponses, optionalMemberIds],
    );

    const summary = useMemo(
        () => summarizeGigResponses(memberInfos, optionalMemberIds, memberResponses),
        [memberInfos, optionalMemberIds, memberResponses],
    );

    const hasOptionalMembers = summary.optional.length > 0;

    return (
        <section className="space-y-4 rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-4">
            <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-rose-200/80">
                    Potential Gig Members
                </div>
                <p className="text-sm text-muted-foreground">
                    Mark members who are optional for this booking. Everyone else must confirm before the gig is locked in.
                </p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    Unable to load band members. Try again from the dashboard and make sure you have access to this band.
                </div>
            ) : members.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    No active band members found. Add members to manage potential gigs.
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {members.map((member) => {
                            const label = labelMap.get(member.id) ?? 'Member';
                            const isOptional = optionalSet.has(member.id);
                            return (
                                <Button
                                    key={member.id}
                                    type="button"
                                    size="sm"
                                    variant={isOptional ? 'outline' : 'secondary'}
                                    className={cn(
                                        'h-9 rounded-full border px-3 transition-all',
                                        isOptional
                                            ? 'border-dashed border-rose-400/70 bg-transparent text-foreground hover:border-rose-300'
                                            : 'border-rose-500/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30',
                                    )}
                                    onClick={() => onToggle(member.id)}
                                    disabled={loading}
                                    aria-pressed={!isOptional}
                                >
                                    {label}
                                </Button>
                            );
                        })}
                    </div>

                    {loading && (
                        <div className="text-sm text-muted-foreground">Updating roster…</div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MemberStatusGroup
                            title="Yes"
                            members={summary.yes}
                            emptyLabel="No confirmed members yet"
                            accent="positive"
                        />
                        <div className="space-y-4">
                            <MemberStatusGroup
                                title="No"
                                members={summary.no}
                                emptyLabel="No declines recorded"
                                accent="negative"
                            />
                            {!hasOptionalMembers && summary.notResponded.length > 0 && (
                                <MemberStatusGroup
                                    title="Not responded"
                                    members={summary.notResponded}
                                    emptyLabel=""
                                />
                            )}
                        </div>
                        {hasOptionalMembers && (
                            <MemberStatusGroup
                                title="Optional"
                                members={summary.optional}
                                emptyLabel="No optional members"
                                accent="neutral"
                            />
                        )}
                        {hasOptionalMembers && (
                            <MemberStatusGroup
                                title="Not responded"
                                members={summary.notResponded}
                                emptyLabel="Waiting on replies"
                                accent="neutral"
                            />
                        )}
                    </div>
                </div>
            )}

            {mode === 'edit' && memberResponses.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    Responses update automatically as members reply. Optional selections only affect future confirmations.
                </div>
            )}
        </section>
    );
}

export default PotentialGigMembersSection;
