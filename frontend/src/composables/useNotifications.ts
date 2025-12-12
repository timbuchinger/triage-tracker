import { useNotificationStore, type NotificationType } from '@/stores/notifications';

export interface NotificationOptions {
  details?: string;
  dismissible?: boolean;
  autoDismiss?: boolean;
  timeout?: number;
}

export function useNotifications() {
  const store = useNotificationStore();

  function notify(
    message: string,
    type: NotificationType = 'info',
    options: NotificationOptions = {}
  ) {
    store.addNotification({
      message,
      type,
      ...options,
    });
  }

  function info(message: string, options: NotificationOptions = {}) {
    notify(message, 'info', options);
  }

  function success(message: string, options: NotificationOptions = {}) {
    notify(message, 'info', options);
  }

  function warning(message: string, options: NotificationOptions = {}) {
    notify(message, 'warning', { ...options, autoDismiss: false });
  }

  function error(message: string, options: NotificationOptions = {}) {
    notify(message, 'error', { ...options, autoDismiss: false });
  }

  function dismiss(id: string) {
    store.dismissNotification(id);
  }

  function clear() {
    store.clearAll();
  }

  return {
    notify,
    info,
    success,
    warning,
    error,
    dismiss,
    clear,
  };
}
