<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string;
    id?: string;
    hint?: string;
    error?: string;
    required?: boolean;
  }>(),
  {
    label: "",
    id: undefined,
    hint: "",
    error: "",
    required: false
  }
);
</script>

<template>
  <div class="form-control w-full gap-2">
    <label v-if="label" class="label pb-0" :for="id">
      <span
        class="label-text text-xs font-medium text-base-content/70 uppercase tracking-wide"
      >
        {{ label }}
        <span v-if="required" class="text-error ml-0.5">*</span>
      </span>
    </label>

    <slot />

    <div class="min-h-[16px]">
      <p v-if="error" class="text-xs text-error mt-1">
        {{ error }}
      </p>
      <p v-else-if="hint" class="text-xs text-base-content/60 mt-1">
        {{ hint }}
      </p>
    </div>
  </div>
</template>
