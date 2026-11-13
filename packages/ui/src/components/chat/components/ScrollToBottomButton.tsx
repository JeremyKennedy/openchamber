import React from 'react';

import { Icon } from "@/components/icon/Icon";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { useAgentStatusLabel } from '@/hooks/useAgentStatusLabel';
import { useAssistantStatus } from '@/hooks/useAssistantStatus';
import { useBackgroundSessionWork } from '@/hooks/useBackgroundSessionWork';
import { useConfigStore } from '@/stores/useConfigStore';
import { getProviderModelDisplayName } from '@/lib/modelDisplay';
import { BackgroundWorkButton } from './BackgroundWorkButton';
import { registerFloatingPanelClearanceReader } from '@/components/chat/composer/state/composerInsetReaders';

/** The scroll action: the arrow, plus the status label while the session works. */
const ScrollAction: React.FC<{ onClick: () => void; children?: React.ReactNode }> = ({ onClick, children }) => {
    const { t } = useI18n();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {/* Sits inside the pill's hairline border, so the pill as a whole is
                    28px like the status row it takes over from. */}
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={t('chat.scrollToBottom.aria')}
                    className="inline-flex h-[calc(1.75rem-2px)] min-w-0 max-w-full flex-1 items-center rounded-full [corner-shape:round] text-start"
                >
                    {/* flex-1 so the icon stays centred when the mobile
                        touch-target floor widens the bare button past 28px;
                        with the status label present it collapses back to
                        its 28px basis. */}
                    <span className="flex h-full w-7 flex-1 shrink-0 basis-7 items-center justify-center text-muted-foreground">
                        <Icon name="arrow-down" className="h-4 w-4" />
                    </span>
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>{t('chat.scrollToBottom.aria')}</TooltipContent>
        </Tooltip>
    );
};

/**
 * The pill's other end: back to the start of the previous reply, for a reader
 * who scrolled past it. Sits beside the down arrow in the same surface so both
 * jumps stay one floating control.
 */
export const ScrollToReplyStartAction: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const { t } = useI18n();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={t('chat.scrollToReplyStart.aria')}
                    className="inline-flex h-[calc(1.75rem-2px)] w-7 shrink-0 items-center justify-center rounded-full [corner-shape:round] text-muted-foreground"
                >
                    <Icon name="arrow-up" className="h-4 w-4" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>{t('chat.scrollToReplyStart.aria')}</TooltipContent>
        </Tooltip>
    );
};

/**
 * Compact one-line mirror of the status row for the pill: same label and
 * background action, none of the status row's animation machinery (which does
 * not survive being squeezed into a 28px chip). The action is a sibling of the
 * scroll button, never inside it.
 */
const WorkingPillBody: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const { activeModel, working } = useAssistantStatus();
    const providers = useConfigStore((state) => state.providers);
    const backgroundWork = useBackgroundSessionWork();

    const modelName = React.useMemo(() => {
        if (!activeModel) return null;
        const provider = providers.find((candidate) => candidate.id === activeModel.providerId);
        return getProviderModelDisplayName(provider, activeModel.modelId) || null;
    }, [activeModel, providers]);

    const label = useAgentStatusLabel(working.isWorking ? working.status : null, modelName);
    if (!label) return <ScrollAction onClick={onClick} />;

    return (
        <>
            <ScrollAction onClick={onClick}>
                {/* leading-5: `truncate` clips at the line box, and a 16px one
                    cut off descenders in fonts with taller metrics. */}
                <span className={cn('-ms-px min-w-0 truncate text-[0.8125rem] leading-5 text-muted-foreground', working.canBackground ? 'pe-1' : 'pe-2')}>
                    {label}
                </span>
            </ScrollAction>
            {working.canBackground ? <BackgroundWorkButton onClick={backgroundWork} className="me-0.5 h-6 w-6" /> : null}
        </>
    );
};

interface ScrollToBottomButtonProps {
    /** The reader left the live edge, so the pill is on screen. At the live
        edge it stays out of the way: the floating status row carries the way
        back there while the session works, and nothing when it is idle. */
    visible: boolean;
    /** The reader left the live edge, so the down arrow and its status label
        apply. At the live edge the floating status row still carries them. */
    awayFromLiveEdge: boolean;
    /** The session is still streaming: the pill carries the status label
        while the floating status row is hidden away from the live edge. */
    working?: boolean;
    /** Absent when no reply start sits above the viewport, or while the status
        chip carries the same arrow at the live edge: the arrow always moves
        up, landing on the reply the reader has already scrolled past. */
    onScrollToReplyStart?: () => void;
    onClick: () => void;
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
    visible,
    awayFromLiveEdge,
    working = false,
    onScrollToReplyStart,
    onClick,
}) => {
    return (
        <div
            ref={registerFloatingPanelClearanceReader}
            className={cn(
                'pointer-events-none absolute bottom-full inset-x-0 mb-2 transition-opacity duration-100',
                visible ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transform: 'translateY(calc(-1 * var(--chat-floating-panel-clearance, 0px)))' }}
        >
            {/* The same column that centres the composer, so the pill's left
                edge lines up exactly with the input frame. */}
            <div className="chat-input-column">
                {/* The soft shadow lives on this wrapper, apart from the
                    pill itself. */}
                <div className="inline-flex max-w-full rounded-full shadow-[0_2px_6px_-2px_rgb(0_0_0_/_0.10)] dark:shadow-[0_2px_6px_-2px_rgb(0_0_0_/_0.35)]">
                <div
                    className={cn(
                        // Opaque surface with a hairline border, much lighter
                        // than the oc-glass-floating shadow stack.
                        // min-h, not h: the mobile touch-target floor grows
                        // the buttons inside to 36px, and the pill with them.
                        'oc-surface-floating inline-flex min-h-7 max-w-full items-center rounded-full [corner-shape:round]',
                        'border border-black/[0.06] dark:border-white/[0.08]',
                        visible ? 'pointer-events-auto' : 'pointer-events-none',
                    )}
                >
                    {onScrollToReplyStart ? <ScrollToReplyStartAction onClick={onScrollToReplyStart} /> : null}
                    {awayFromLiveEdge
                        ? (working ? <WorkingPillBody onClick={onClick} /> : <ScrollAction onClick={onClick} />)
                        : null}
                </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ScrollToBottomButton);
