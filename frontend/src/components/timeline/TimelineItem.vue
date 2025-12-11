<script setup lang="ts">
import { computed } from 'vue';
import type { TimelineEvent } from '@/api/incidents';

const props = defineProps<{ event: TimelineEvent }>();

const displayType = computed(() => {
  if (!props.event || !props.event.type) return '';
  if (props.event.type === 'HIGHLIGHTED_MESSAGE') return 'HIGHLIGHTED';
  return props.event.type;
});

const capitalize = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

const statusText = computed(() => {
  if (props.event.type !== 'STATUS_CHANGE') return '';
  const md = props.event.metadata as any;
  if (md?.fromStatus && md?.toStatus) {
    return `${capitalize(md.fromStatus)} -> ${capitalize(md.toStatus)}`;
  }
  return props.event.message || '';
});

const actor = computed(() => {
  return props.event.slackUser || (props.event.metadata as any)?.actorName || (props.event.metadata as any)?.capturedBy || '';
});
</script>

<template>
  <div class="rounded-lg border border-base-200 p-3">
    <div class="flex items-center justify-between text-xs text-base-content/70">
      <span class="font-semibold">{{ displayType }}</span>
      <span>{{ new Date(props.event.timestamp).toLocaleString() }}</span>
    </div>

    <p v-if="props.event.type === 'STATUS_CHANGE'" class="text-sm text-base-content mt-1">
      {{ statusText }}
    </p>

    <p v-else-if="props.event.message" class="text-sm text-base-content mt-1">
      {{ props.event.message }}
    </p>

    <div v-if="actor" class="text-xs text-base-content/60 mt-1">
      By: {{ actor }}
    </div>
  </div>
</template>

<style scoped>
/* minimal styles inherit from app */
</style>
