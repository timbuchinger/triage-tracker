<script setup lang="ts">
import { watch, ref, onMounted, onUnmounted } from 'vue';
import { useNotificationStore } from '@/stores/notifications';
import UiNotification from '@/components/ui/UiNotification.vue';

const store = useNotificationStore();
const timeoutId = ref<number | null>(null);

watch(
  () => store.activeNotification,
  (notification) => {
    if (timeoutId.value) {
      clearTimeout(timeoutId.value);
      timeoutId.value = null;
    }

    if (notification && notification.autoDismiss && notification.timeout) {
      timeoutId.value = window.setTimeout(() => {
        store.dismissNotification(notification.id);
      }, notification.timeout);
    }
  },
  { immediate: true }
);

function handleDismiss() {
  if (store.activeNotification) {
    store.dismissNotification(store.activeNotification.id);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && store.activeNotification) {
    handleDismiss();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-300"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="store.activeNotification"
      class="w-full max-w-6xl mx-auto px-4 py-2"
    >
      <UiNotification
        :type="store.activeNotification.type"
        :message="store.activeNotification.message"
        :details="store.activeNotification.details"
        :dismissible="store.activeNotification.dismissible"
        @dismiss="handleDismiss"
      />
    </div>
  </Transition>
</template>
