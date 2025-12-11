<script setup lang="ts">
import { toRef } from 'vue';
import UiModal from "@/components/ui/UiModal.vue";
import UiButton from "@/components/ui/UiButton.vue";

interface Props {
  modelValue: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmVariant?: 'error' | 'primary' | 'ghost';
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  message: '',
  confirmLabel: 'Confirm',
  confirmVariant: 'error',
  loading: false,
});

const modelValue = toRef(props, 'modelValue');
const title = toRef(props, 'title');
const message = toRef(props, 'message');
const confirmLabel = toRef(props, 'confirmLabel');
const confirmVariant = toRef(props, 'confirmVariant');
const loading = toRef(props, 'loading');

const emit = defineEmits<{
  'update:modelValue': (val: boolean) => void;
  'confirm': () => void;
}>();

function close() {
  emit('update:modelValue', false);
}

function onConfirm() {
  emit('confirm');
}
</script>

<template>
  <UiModal :modelValue="modelValue" :title="title" @update:modelValue="(v) => emit('update:modelValue', v)">
    <p v-if="message" class="mb-4">{{ message }}</p>
    <template #actions>
      <UiButton :disabled="loading" @click="close">Cancel</UiButton>
      <UiButton :variant="confirmVariant" :loading="loading" @click="onConfirm">{{ confirmLabel }}</UiButton>
    </template>
  </UiModal>
</template>
