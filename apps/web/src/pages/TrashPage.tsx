import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { useToast } from '../components/Toaster';
import type { TrashEntry } from '../api/client.types';

export function TrashPage() {
  const { refresh } = useIndex();
  const toast = useToast();
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getTrash()
      .then((result) => setEntries(result.entries))
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'could not read the trash'), 'error'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = (id: string) => {
    setBusy(true);
    api
      .restoreTrash(id)
      .then(() => {
        load();
        refresh();
        toast.push('Restored to its original location', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'restore failed'), 'error'))
      .finally(() => setBusy(false));
  };

  const purge = (id: string) => {
    setBusy(true);
    api
      .purgeTrash(id)
      .then(() => {
        load();
        toast.push('Purged permanently', 'ok');
      })
      .catch((cause: unknown) => toast.push(errorMessage(cause, 'purge failed'), 'error'))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <div className="page-eyebrow">Recovery</div>
          <div className="page-title-row"><h1>Trash</h1><span className="page-count">{entries.length}</span></div>
          <p className="page-description">Restore removed skills and their links, or permanently purge them.</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="surface empty-state">Nothing in the trash.</div>
      ) : (
        <div className="surface table-scroll"><table>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Skill</th>
              <th style={{ width: 190 }}>Trashed</th>
              <th>Came from</th>
              <th style={{ width: 170 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.name}</td>
                <td>{new Date(entry.trashedAt).toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, wordBreak: 'break-all' }}>
                  {entry.originPath}
                  {entry.removedLinks.length > 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>
                      {`${entry.removedLinks.length} symlink(s) removed, restored with it`}
                    </div>
                  ) : null}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => restore(entry.id)} disabled={busy}>
                      Restore
                    </button>
                    <button
                      onClick={() => purge(entry.id)}
                      disabled={busy}
                      style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    >
                      Purge
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
