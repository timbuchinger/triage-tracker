<script setup lang="ts">
import { RouterView } from "vue-router";
import Sidebar from "./Sidebar.vue";
import TopNav from "./TopNav.vue";
import NotificationContainer from "./NotificationContainer.vue";
</script>

<template>
  <div class="min-h-screen flex bg-base-200 text-base-content">
    <Sidebar class="hidden md:flex" />
    <div class="flex-1 flex flex-col">
      <TopNav />
      <NotificationContainer />
      <main class="flex-1 p-4">
        <div class="max-w-6xl mx-auto">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
