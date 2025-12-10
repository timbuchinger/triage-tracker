<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const authStore = useAuthStore();

const items = computed(() => [
  { name: "Incidents", to: { name: "incidents" }, icon: "⚡" },
  { name: "Create Incident", to: { name: "incident-create" }, icon: "➕" },
  ...(authStore.isOwner ? [{ name: "Members", to: { name: "organization-members" }, icon: "👥" }] : []),
  ...(authStore.isOwner ? [{ name: "Teams", to: { name: "teams" }, icon: "🧩" }] : []),
  { name: "Services", to: { name: "services" }, icon: "📦" },
  { name: "Settings", to: { name: "settings" }, icon: "⚙️" }
]);

const isActive = (to: any) => {
  return route.name === to.name;
};
</script>

<template>
  <aside class="w-64 bg-base-100 border-r border-base-300 flex flex-col">
    <div class="h-16 border-b border-base-300 px-4 flex items-center">
      <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Navigation</span>
    </div>
    <nav class="flex-1 px-2 py-4 space-y-1">
      <RouterLink
        v-for="item in items"
        :key="item.name"
        :to="item.to"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-base-200"
        :class="isActive(item.to) ? 'bg-base-200 font-medium' : 'text-base-content/80'"
      >
        <span>{{ item.icon }}</span>
        <span>{{ item.name }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>
