import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type NotificationType = 'info' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  dismissible?: boolean;
  autoDismiss?: boolean;
  timeout?: number;
  createdAt: Date;
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);

  const activeNotification = computed(() =>
    notifications.value.length > 0 ? notifications.value[0] : null
  );

  function addNotification(notification: Omit<Notification, 'id' | 'createdAt'>) {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      // notifications are dismissible by default
      dismissible: notification.dismissible ?? true,
      // enable auto-dismiss by default for non-error notifications so
      // info/warning messages don't stay visible indefinitely. Errors
      // require explicit dismissal unless caller sets `autoDismiss`.
      autoDismiss: notification.autoDismiss ?? (notification.type !== 'error'),
      timeout: notification.timeout ?? 5000,
    };

    notifications.value.push(newNotification);
  }

  function dismissNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }

  function clearErrors() {
    // Remove only error-type notifications (keep info/warning)
    notifications.value = notifications.value.filter(n => n.type !== 'error');
  }

  function clearAll() {
    notifications.value = [];
  }

  return {
    notifications,
    activeNotification,
    addNotification,
    dismissNotification,
    clearErrors,
    clearAll,
  };
});
