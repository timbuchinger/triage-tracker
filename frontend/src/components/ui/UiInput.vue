<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | number | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null];
}>();

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
};
</script>

<template>
  <input
    v-bind="$attrs"
    :value="modelValue ?? ''"
    @input="onInput"
    class="input input-bordered w-full rounded-md text-sm"
  />
</template>
