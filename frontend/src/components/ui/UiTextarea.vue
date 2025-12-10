<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | number | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null];
}>();

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:modelValue", target.value);
};
</script>

<template>
  <textarea
    v-bind="$attrs"
    :value="modelValue ?? ''"
    @input="onInput"
    class="textarea textarea-bordered w-full rounded-md text-sm"
  />
</template>
