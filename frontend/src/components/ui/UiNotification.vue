<script setup lang="ts">
import type { NotificationType } from '@/stores/notifications';

interface Props {
  type: NotificationType;
  message: string;
  details?: string;
  dismissible?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  dismiss: [];
}>();

function handleDismiss() {
  emit('dismiss');
}
</script>

<template>
  <div
    role="alert"
    class="alert rounded-lg flex items-start gap-3 min-w-0"
    :class="{
      'alert-info': type === 'info',
      'alert-warning': type === 'warning',
      'alert-error': type === 'error',
    }"
  >
    <!-- Icon column: stretch to match text height -->
    <div class="flex-shrink-0 self-stretch flex items-center">
      <svg
        v-if="type === 'info'"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        class="stroke-current shrink-0 h-12 w-12"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <svg
        v-else-if="type === 'warning'"
        xmlns="http://www.w3.org/2000/svg"
        class="stroke-current shrink-0 h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <svg
        v-else-if="type === 'error'"
        xmlns="http://www.w3.org/2000/svg"
        class="stroke-current shrink-0 h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>

    <div class="flex-1 min-w-0">
      <div>
        <span class="block font-semibold break-words whitespace-normal max-w-full">{{ message }}</span>
        <p v-if="details" class="text-sm break-words whitespace-normal">{{ details }}</p>
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      class="btn btn-sm btn-ghost"
      @click="handleDismiss"
      aria-label="Dismiss notification"
    >
      ✕
    </button>
  </div>
</template>
