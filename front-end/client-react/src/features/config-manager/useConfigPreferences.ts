import { useMemo } from 'react';
import { useConfigCommands } from './useConfigResource';
import { useWorkspacePreferences, type Preferences } from '../../services/preferences';

export function useConfigPreferences() {
  const commands = useConfigCommands();
  const transport = useMemo(() => ({
    loadPreferences: () => commands.query<Preferences>('preferences'),
    loadNotifications: () => commands.query<{ items: { id: string; title: string; message: string }[] }>(
      'notifications', { page: 1, pageSize: 25, state: 'unread' }),
  }), [commands]);
  useWorkspacePreferences(transport);
}
