import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { formatElapsed } from '@/lib/format';
import { usePresenceStore } from '@/stores/presence.store';

/** Re-renders every `ms` so "меньше минуты" turns into "1 минута" by itself. */
function useTick(ms: number, active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((value) => value + 1), ms);
    return () => clearInterval(timer);
  }, [ms, active]);
}

/**
 * Кто сейчас в системе: имя, адрес устройства и как давно человек подключён.
 * The list comes from the websocket, so it is as live as the connection is.
 */
export function PresenceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const users = usePresenceStore((state) => state.users);
  const connected = usePresenceStore((state) => state.connected);
  useTick(20_000, open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Подключённые пользователи (${users.length})`}
    >
      {!connected && (
        <p className="bg-warning-50 text-warning-700 mb-3 rounded-xl px-3 py-2 text-[13px]">
          Нет связи с сервером в реальном времени — список может быть неполным.
        </p>
      )}
      <div className="table-frame">
        <table className="table-grid w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left">Название</th>
              <th className="px-3 py-2.5 text-right">IP</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Дата / время</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="text-ink-500 py-6 text-center">
                  Сейчас никого нет в системе
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="bg-success-500 size-2 shrink-0 rounded-full" aria-hidden />
                    <span className="text-ink-900 truncate font-medium">{user.fullName}</span>
                    {user.devices > 1 && (
                      <span className="text-ink-400 shrink-0 text-xs">{user.devices} устр.</span>
                    )}
                  </span>
                </td>
                <td className="text-ink-600 tabular px-3 py-2.5 text-right whitespace-nowrap">
                  {user.ip ?? '—'}
                </td>
                <td className="text-ink-600 px-3 py-2.5 text-right whitespace-nowrap">
                  {formatElapsed(user.connectedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
