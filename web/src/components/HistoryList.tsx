import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { useToast } from './Toaster';
import type { JournalEntry } from '../api/client.types';

export function HistoryList(props: { skillId: string }) {
  const { refresh } = useIndex();
  const toast = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getJournal()
      .then((result) => setEntries(result.entries))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const undo = () => {
    setBusy(true);
    api
      .undo()
      .then((result) => {
        load();
        refresh();
        toast.push(`Undid ${result.entry.action}`, 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'undo failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const mine: JournalEntry[] = [];
  for (const entry of entries) {
    if (entry.skillId === props.skillId) {
      mine.push(entry);
    }
  }

  let latestIsMine = false;
  const latest = entries[0];
  if (latest && latest.skillId === props.skillId) {
    latestIsMine = true;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>{`${mine.length} change(s) recorded for this skill`}</span>
        <div style={{ flex: 1 }} />
        <button onClick={undo} disabled={busy || !latestIsMine}>
          Undo latest
        </button>
      </div>
      {!latestIsMine && mine.length > 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
          Undo always reverses the newest change anywhere in Skillet, and that one belongs to another skill.
        </div>
      ) : null}
      {mine.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No changes recorded yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 200 }}>When</th>
              <th style={{ width: 130 }}>Action</th>
              <th>Steps</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.at).toLocaleString()}</td>
                <td>{entry.action}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  {entry.steps.map((current, position) => (
                    <div key={`${entry.id}-${position}`}>{`${current.op} ${current.to}`}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
