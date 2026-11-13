/**
 * The first block of an assistant message's own prose. A step may open with
 * tool rows (or a reasoning trace) before it says anything, and the pill's
 * "back to the reply start" jump should land on the text a reader means, not
 * on the work that led to it.
 *
 * Text parts render as `[data-message-text-export-source]`, the same contract
 * the copy and image export read. A plain answer block has that wrapper too;
 * `group/assistant-text` is a styling group and not a DOM contract, so a bare
 * block is never matched. Reasoning blocks reuse the export attribute, so
 * their descendants are skipped. With `collapsibleThinkingBlocks` off,
 * reasoning draws through AssistantTextPart as a bare `group/assistant-text`
 * row, so it marks itself with `data-reasoning-inline` instead of a block id.
 */
const REPLY_PROSE_SELECTOR = '[data-message-text-export-source]';
const REASONING_SELECTOR = '[data-reasoning-block-id], [data-reasoning-inline]';

export function findReplyProseElement(messageElement: HTMLElement): HTMLElement | null {
    for (const element of messageElement.querySelectorAll<HTMLElement>(REPLY_PROSE_SELECTOR)) {
        if (element.closest(REASONING_SELECTOR)) {
            continue;
        }
        return element;
    }
    return null;
}
