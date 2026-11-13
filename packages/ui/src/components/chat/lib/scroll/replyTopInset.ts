import { MESSAGE_JUMP_GAP_PX, REPLY_START_GAP_PX } from './scrollGaps';

// The sticky prompt covers the top of the viewport when the setting is on.
// Every position below it counts as hidden content.
export const readStuckHeaderHeight = (container: HTMLElement): number => {
    const containerTop = container.getBoundingClientRect().top;
    let height = 0;
    for (const header of container.querySelectorAll<HTMLElement>('[data-turn-sticky-header]')) {
        const rect = header.getBoundingClientRect();
        if (rect.top <= containerTop + 1 && rect.bottom > containerTop) {
            height = Math.max(height, rect.height);
        }
    }
    return height;
};

// A reply whose turn has a sticky prompt starts below it, not at the raw top
// edge. The reply can be grouped under a turn whose own head is not mounted
// (for example an answer appended to a turn whose prompt row is virtualized
// out): the prompt pinned over the viewport is then a different turn's header,
// and it still covers the reply. Fall back to the header actually stuck at the
// top, not the message-jump gap (`scrollGaps.ts`). Without any header the gap
// stays the message-jump gap.
export const replyTopInset = (container: HTMLElement, element: HTMLElement): number => {
    const turnId = element.closest<HTMLElement>('[data-turn-row]')?.dataset.turnRow
        ?? element.closest<HTMLElement>('[data-turn-id]')?.dataset.turnId;
    if (turnId) {
        const header = container.querySelector<HTMLElement>(`[data-turn-id="${CSS.escape(turnId)}"] > [data-turn-sticky-header]`);
        const headerHeight = header?.getBoundingClientRect().height ?? 0;
        if (headerHeight > 0) {
            return headerHeight + REPLY_START_GAP_PX;
        }
    }
    const stuckHeaderHeight = readStuckHeaderHeight(container);
    return stuckHeaderHeight > 0 ? stuckHeaderHeight + REPLY_START_GAP_PX : MESSAGE_JUMP_GAP_PX;
};
