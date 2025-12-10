<template>
  <div
    :class="[
      'skeleton',
      variantClass,
      block ? 'w-full' : '',
      roundedClass,
      className
    ]"
    role="status"
    aria-busy="true"
  >
    <span v-if="label" class="sr-only">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'text' | 'rect' | 'circle'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  rounded?: 'md' | 'lg' | 'full'
  label?: string
  className?: string
}>(), {
  variant: 'rect',
  size: 'md',
  block: true,
  rounded: 'md',
  label: 'Loading',
  className: ''
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'text':
      return 'skeleton-text'
    case 'circle':
      return 'rounded-full w-8 h-8'
    default:
      return ''
  }
})

const roundedClass = computed(() => {
  switch (props.rounded) {
    case 'lg':
      return 'rounded-lg'
    case 'full':
      return 'rounded-full'
    default:
      return 'rounded-md'
  }
})
</script>

<style scoped></style>
