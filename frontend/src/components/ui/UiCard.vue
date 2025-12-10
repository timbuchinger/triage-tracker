<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    padded?: boolean;
  }>(),
  { padded: true }
);
</script>

<template>
  <div class="card bg-base-100 shadow-md rounded-lg border border-base-300">
    <div :class="['flex flex-col gap-3', padded && 'p-4']">
      <slot />
    </div>
  </div>
</template>
