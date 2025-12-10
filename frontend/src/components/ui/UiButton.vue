<script setup lang="ts">
import type { ButtonHTMLAttributes } from "vue";

interface UiButtonProps extends /* @vue-ignore */ ButtonHTMLAttributes {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "base";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  active?: boolean;
}

const props = withDefaults(
  defineProps<UiButtonProps>(),
  {
    variant: "primary",
    size: "md",
    loading: false
  }
);

const base = "btn rounded-md font-medium normal-case";

const variantClasses: Record<string, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  danger: "btn-error text-error-content",
  base: ""
};

const sizeClasses: Record<string, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg"
};
</script>

<template>
  <button
    v-bind="$attrs"
    :class="[base, variantClasses[variant], sizeClasses[size], loading && 'btn-disabled', active && 'btn-active']"
  >
    <span v-if="loading" class="loading loading-spinner loading-xs mr-2" />
    <slot />
  </button>
</template>
