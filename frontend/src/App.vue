<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";

const route = useRoute();
const isPublicRoute = computed(() => route.meta.public === true);
</script>

<template>
  <AppShell v-if="!isPublicRoute" />
  <RouterView v-else />
</template>
