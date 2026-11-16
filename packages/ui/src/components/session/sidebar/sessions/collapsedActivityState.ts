import React from 'react';
import type { SessionNode } from '../types';
import { useGlobalSessionStatusStore } from '@/sync/global-session-status';
import { useBackgroundShellsStore } from '@/sync/background-shells';
import { useBackgroundImagesStore } from '@/sync/background-images';
import { usePrWatchStore } from '@/sync/pr-watch';
import { useExtensionWaitsStore } from '@/sync/extension-waits';
import { resolveGlobalSessionDirectory, useGlobalSessionsStore } from '@/stores/useGlobalSessionsStore';
import { isSessionUnread } from '@/sync/session-unread';
import { useSessionBlockingRequests } from '@/sync/sync-context';
import { selectBlockingBadgeSessionScopes } from './sessionNodeItemUtils';

// Ordered by how much the user is needed: a blocked turn outranks a running
// one, which outranks something merely unread.
export type CollapsedActivityState = 'permission' | 'form' | 'active' | 'unread' | null;

const mergeCollapsedActivityStates = (
  current: CollapsedActivityState,
  next: CollapsedActivityState,
): CollapsedActivityState => {
  if (current === 'active' || next === 'active') return 'active';
  if (current === 'unread' || next === 'unread') return 'unread';
  return null;
};

const getSessionNodeActivityState = (
  node: SessionNode,
  activeSessionIds: Set<string>,
  unreadSessionIds: Set<string>,
): CollapsedActivityState => {
  if (activeSessionIds.has(node.session.id)) return 'active';

  let state: CollapsedActivityState = null;
  // A subtask is never unread on its own; its parent carries the mark.
  if (unreadSessionIds.has(node.session.id) && !node.session.parentID) state = 'unread';

  for (const child of node.children) {
    state = mergeCollapsedActivityStates(
      state,
      getSessionNodeActivityState(child, activeSessionIds, unreadSessionIds),
    );
    if (state === 'active') return state;
  }

  return state;
};

export const getSessionNodesActivityState = (
  nodes: SessionNode[],
  activeSessionIds: Set<string>,
  unreadSessionIds: Set<string>,
): CollapsedActivityState => {
  let state: CollapsedActivityState = null;
  for (const node of nodes) {
    state = mergeCollapsedActivityStates(
      state,
      getSessionNodeActivityState(node, activeSessionIds, unreadSessionIds),
    );
    if (state === 'active') return state;
  }
  return state;
};

type SessionActivityProps = {
  nodes: readonly SessionNode[];
  // Sessions not present as nodes whose pending requests still count, such as
  // the hidden subagents of timeline rows.
  blockingSessionIds?: readonly string[];
};

/** Every session in the hidden subtrees, and the top-level ones among them: only those can be unread. */
const collectActivityIds = (nodes: readonly SessionNode[]) => {
  const active = new Set<string>();
  const unread = new Set<string>();
  const visit = (node: SessionNode, isSubtask: boolean): void => {
    active.add(node.session.id);
    if (!isSubtask) unread.add(node.session.id);
    node.children.forEach((child) => visit(child, true));
  };
  nodes.forEach((node) => visit(node, false));
  return { active, unread };
};

export const useCollapsedSessionActivityState = ({
  nodes,
  blockingSessionIds,
  enabled = true,
}: SessionActivityProps & { enabled?: boolean }): CollapsedActivityState => {
  const ids = React.useMemo(() => collectActivityIds(enabled ? nodes : []), [enabled, nodes]);
  const blockingIds = React.useMemo(
    () => (blockingSessionIds && blockingSessionIds.length > 0 ? new Set([...ids.active, ...blockingSessionIds]) : ids.active),
    [blockingSessionIds, ids.active],
  );
  // Where each counted session lives, as JSON: the subscription follows the
  // resolved directories instead of the session map identity, so a change to an
  // unrelated session does not rebuild the scopes of a collapsed header, and a
  // directory containing any separator still encodes unambiguously.
  const blockingDirectorySignature = useGlobalSessionsStore(React.useCallback((state) => {
    if (!enabled || blockingIds.size === 0) return '';
    const entries: [string, string][] = [];
    for (const sessionId of blockingIds) {
      const session = state.entityById.get(sessionId);
      entries.push([sessionId, session ? resolveGlobalSessionDirectory(session) ?? '' : '']);
    }
    return JSON.stringify(entries);
  }, [blockingIds, enabled]));
  const active = useGlobalSessionStatusStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.active) {
      const status = state.statusById.get(sessionId)?.status.type;
      if (status === 'busy' || status === 'retry') return 'active';
    }
    return null;
  }, [enabled, ids.active]));
  // A session idling while its background command runs is still at work.
  const waitingOnShell = useBackgroundShellsStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.active) {
      if (state.sessionIds.has(sessionId)) return 'active';
    }
    return null;
  }, [enabled, ids.active]));
  // And one waiting on an image it started.
  const waitingOnImage = useBackgroundImagesStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.active) {
      if (state.sessionIds.has(sessionId)) return 'active';
    }
    return null;
  }, [enabled, ids.active]));
  // So is one waiting on its pull request: the server wakes it.
  const waitingOnPullRequest = usePrWatchStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.active) {
      if (state.bySession.has(sessionId)) return 'active';
    }
    return null;
  }, [enabled, ids.active]));
  // And one waiting on a timer or an extension.
  const waitingOnExtension = useExtensionWaitsStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.active) {
      if (state.bySession.has(sessionId)) return 'active';
    }
    return null;
  }, [enabled, ids.active]));
  const unread = useGlobalSessionsStore(React.useCallback((state): CollapsedActivityState => {
    if (!enabled) return null;
    for (const sessionId of ids.unread) {
      if (isSessionUnread(state.entityById.get(sessionId))) return 'unread';
    }
    return null;
  }, [enabled, ids.unread]));
  // Pending requests come from the directory store once it has read its own
  // request snapshots, and from the cross-directory index before that, exactly
  // as a session row counts them: a collapsed group in a project that was
  // never opened still shows a seeded request, while a form the index kept
  // after a lost settlement stops showing once its store is authoritative.
  // Subtasks count too: a permission asked by a subagent blocks the whole
  // family.
  const scopes = React.useMemo(() => {
    // Nothing counted, or nothing to resolve: the signature also tells the memo
    // when a counted session's directory becomes known, since the helper below
    // reads that resolution from the store.
    if (!enabled || blockingDirectorySignature === '') return [];
    const sessionIDsByDirectory = new Map<string, string[]>();
    const unplacedSessionIDs: string[] = [];
    const add = (directory: string | null, sessionID: string) => {
      // A session with no known directory has no store to answer for it, so the
      // lookup reads the index for it instead.
      if (!directory) {
        unplacedSessionIDs.push(sessionID);
        return;
      }
      const sessionIDs = sessionIDsByDirectory.get(directory) ?? [];
      sessionIDs.push(sessionID);
      sessionIDsByDirectory.set(directory, sessionIDs);
    };
    for (const node of nodes) {
      // Every session under a collapsed header is hidden, so all of them count.
      for (const scope of selectBlockingBadgeSessionScopes(node, false, null)) {
        for (const sessionID of scope.sessionIDs) add(scope.directory, sessionID);
      }
    }
    for (const sessionID of blockingSessionIds ?? []) {
      const session = useGlobalSessionsStore.getState().entityById.get(sessionID);
      add(session ? resolveGlobalSessionDirectory(session) : null, sessionID);
    }
    const scopes: { directory: string | null; sessionIDs: string[] }[] = [...sessionIDsByDirectory]
      .map(([directory, sessionIDs]) => ({ directory, sessionIDs }));
    if (unplacedSessionIDs.length > 0) scopes.push({ directory: null, sessionIDs: unplacedSessionIDs });
    return scopes;
  }, [blockingDirectorySignature, blockingSessionIds, enabled, nodes]);
  const scopedRequests = useSessionBlockingRequests(scopes);
  const blocked: CollapsedActivityState = !enabled
    ? null
    : scopedRequests.hasPermission
      ? 'permission'
      : scopedRequests.hasForm
        ? 'form'
        : null;
  return blocked ?? active ?? waitingOnShell ?? waitingOnImage ?? waitingOnPullRequest ?? waitingOnExtension ?? unread;
};
