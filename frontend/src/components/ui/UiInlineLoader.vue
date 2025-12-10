<template>
  <span
    :class="['inline-block', 'align-middle', 'loading', 'loading-spinner', sizeClass, className]"
    role="status"
    aria-hidden="false"
  >
    <span class="sr-only">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}>(), {
  size: 'sm',
  label: 'Loading',
  className: ''
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'loading-xs'
    case 'sm':
      return 'loading-sm'
    case 'lg':
      return 'loading-lg'
    default:
      return 'loading-md'
  }
})
</script>

<style scoped></style>
