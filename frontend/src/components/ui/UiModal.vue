<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const close = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <div v-if="modelValue" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ title }}</h3>
      <div class="py-4">
        <slot />
      </div>
      <div class="modal-action">
        <slot name="actions">
          <button class="btn" @click="close">Close</button>
        </slot>
      </div>
    </div>
  </div>
</template>
