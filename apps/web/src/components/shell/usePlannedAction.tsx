import { useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import type { FsStep, OpResult } from '../../api/client.types';
import { useIndex } from '../../app/IndexProvider';
import { PlanDialog } from '../PlanDialog';
import { useToast } from '../Toaster';

type PlannedRun = (dryRun: boolean) => Promise<OpResult>;

interface PendingAction {
  title: string;
  steps: FsStep[];
  run: PlannedRun;
  success: string;
  options: PlannedOptions;
}

export interface PlannedOptions {
  confirmLabel: string;
  note: string;
}

const DEFAULT_OPTIONS: PlannedOptions = { confirmLabel: 'Apply', note: '' };

/** Preview a filesystem change, show its steps, and only apply it on confirm. Shared by trash, plugin and cache actions. */
export function usePlannedAction(): { start: (title: string, run: PlannedRun, success: string, options?: PlannedOptions) => Promise<void>; dialog: ReactNode; busy: boolean } {
  const { refresh } = useIndex();
  const toast = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const start = async (title: string, run: PlannedRun, success: string, options: PlannedOptions = DEFAULT_OPTIONS) => {
    setBusy(true);
    setFailure('');
    try {
      const preview = await run(true);
      setPending({ title, steps: preview.steps, run, success, options });
    } catch (cause) {
      toast.push(errorMessage(cause, 'could not prepare this change; nothing was applied'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!pending) {
      return;
    }
    setBusy(true);
    try {
      await pending.run(false);
      refresh();
      toast.push(pending.success, 'ok');
      setPending(null);
    } catch (cause) {
      setFailure(errorMessage(cause, 'apply failed'));
    } finally {
      setBusy(false);
    }
  };

  let dialog: ReactNode = null;
  if (pending) {
    dialog = <PlanDialog title={pending.title} steps={pending.steps} busy={busy} error={failure} confirmLabel={pending.options.confirmLabel} note={pending.options.note} onConfirm={() => void apply()} onCancel={() => setPending(null)} />;
  }
  return { start, dialog, busy };
}
