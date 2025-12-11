<script setup lang="ts">
import { withDefaults, defineProps, defineEmits } from 'vue';

interface Props {
  modelValue: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'error' | 'primary' | 'ghost';
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmLabel: 'Confirm',
  confirmVariant: 'error',
  loading: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();
</script>

<template>
  <UiModal :modelValue="modelValue" :title="title" @update:modelValue="(v) => emit('update:modelValue', v)">
    <p>{{ message }}</p>
    <template #actions>
      <UiButton @click="emit('update:modelValue', false)" :disabled="loading">Cancel</UiButton>
      <UiButton :variant="confirmVariant" @click="emit('confirm')" :loading="loading">{{ confirmLabel }}</UiButton>
    </template>
  </UiModal>
</template>

<style scoped>
</style>
