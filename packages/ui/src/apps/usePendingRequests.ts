import React from 'react';

import type { SessionNode } from '@/components/session/sidebar/types';
import { selectBlockingBadgeSessionScopes } from '@/components/session/sidebar/sessions/sessionNodeItemUtils';
import { useSessionBlockingRequests } from '@/sync/sync-context';
import type { BlockingRequestKinds } from '@/sync/global-blocking-requests';

export type PendingRequests = BlockingRequestKinds;

/**
 * Whether a permission request or a form waits for a phone row. It resolves a
 * session's directory exactly as the desktop row does — the same scope helper,
 * the row's own session and worktree included — so both surfaces show the same
 * badge for the same session. A scope whose directory is null has no store to
 * answer for it, and the cross-directory index answers there instead.
 */
export const usePendingRequests = (
  node: SessionNode,
  isExpanded: boolean,
  fallbackDirectory: string | null,
): PendingRequests => {
  const scopes = React.useMemo(
    () => selectBlockingBadgeSessionScopes(node, isExpanded, fallbackDirectory),
    [fallbackDirectory, isExpanded, node],
  );
  return useSessionBlockingRequests(scopes);
};
