<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | number | null | string[] | number[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null | string[] | number[]];
}>();

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  if (target.multiple) {
    const values = Array.from(target.selectedOptions).map((option) => option.value);
    emit("update:modelValue", values);
  } else {
    emit("update:modelValue", target.value || null);
  }
};
</script>

<template>
  <select
    class="select select-bordered w-full rounded-md text-sm"
    :value="modelValue ?? ''"
    @change="onChange"
  >
    <slot />
  </select>
</template>
