import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../../services/api/client';
import { performSubscriptionLifecycleAction } from '../../services/api/platform-subscriptions';
import type { SubscriptionLifecycleAction, SubscriptionLifecycleInput } from '../../types/subscriptions';

interface MutationState {
  /** The action currently being confirmed (dialog is open). */
  pendingAction: SubscriptionLifecycleAction | null;
  /** The action currently being executed (API call in-flight). */
  executingAction: SubscriptionLifecycleAction | null;
  /** Error from the last failed mutation. */
  error: string | null;
  /** Success feedback from the last completed mutation. */
  success: string | null;
}

const INITIAL_STATE: MutationState = {
  pendingAction: null,
  executingAction: null,
  error: null,
  success: null,
};

/**
 * Hook for managing subscription lifecycle mutations with confirmation flow.
 *
 * Usage:
 * 1. Call `requestAction('suspend')` when the user clicks a lifecycle button.
 * 2. A confirmation dialog should appear — check `pendingAction`.
 * 3. Call `confirmAction()` when the user confirms, or `cancelAction()` to dismiss.
 * 4. On success, `onSuccess` is called and the subscription should be reloaded.
 */
export function useSubscriptionMutations(
  subscriptionId: string | undefined,
  onSuccess: () => void,
) {
  const [state, setState] = useState<MutationState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  /** Request an action — opens the confirmation dialog. */
  const requestAction = useCallback((action: SubscriptionLifecycleAction) => {
    setState({
      pendingAction: action,
      executingAction: null,
      error: null,
      success: null,
    });
  }, []);

  /** Cancel the pending action — closes the confirmation dialog. */
  const cancelAction = useCallback(() => {
    setState((current) => ({
      ...current,
      pendingAction: null,
    }));
  }, []);

  /** Dismiss error/success feedback. */
  const dismissFeedback = useCallback(() => {
    setState((current) => ({
      ...current,
      error: null,
      success: null,
    }));
  }, []);

  /** Confirm and execute the pending action. */
  const confirmAction = useCallback(
    async (input?: string | SubscriptionLifecycleInput) => {
      if (!subscriptionId || !state.pendingAction) return;

      const action = state.pendingAction;
      setState({
        pendingAction: null,
        executingAction: action,
        error: null,
        success: null,
      });

      let apiInput: SubscriptionLifecycleInput | undefined;
      if (typeof input === 'string') {
        try {
          apiInput = JSON.parse(input);
        } catch {
          apiInput = { reason: input };
        }
      } else if (input) {
        apiInput = input;
      }

      try {
        await performSubscriptionLifecycleAction(
          subscriptionId,
          action,
          apiInput,
        );

        if (mountedRef.current) {
          setState({
            pendingAction: null,
            executingAction: null,
            error: null,
            success: `Subscription ${action} completed successfully.`,
          });
          onSuccess();
        }
      } catch (caught) {
        if (!mountedRef.current) return;
        const message =
          caught instanceof ApiError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : `Failed to ${action} subscription.`;
        setState({
          pendingAction: null,
          executingAction: null,
          error: message,
          success: null,
        });
      }
    },
    [subscriptionId, state.pendingAction, onSuccess],
  );

  return {
    ...state,
    requestAction,
    cancelAction,
    confirmAction,
    dismissFeedback,
  };
}
