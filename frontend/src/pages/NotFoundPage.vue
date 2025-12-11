<script setup lang="ts">
import { useRouter } from "vue-router";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";

const router = useRouter();

const goHome = () => {
  router.push({ name: "incidents" });
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-base-200 p-4">
    <UiCard class="max-w-md w-full text-center">
      <div class="space-y-4">
        <div class="text-6xl font-bold text-primary">404</div>
        <h1 class="text-xl font-semibold">Page Not Found</h1>
        <p class="text-base-content/70">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div class="flex gap-3 justify-center pt-3">
          <UiButton @click="goBack" variant="ghost">
            Go Back
          </UiButton>
          <UiButton @click="goHome" variant="primary">
            Go to Home
          </UiButton>
        </div>
      </div>
    </UiCard>
  </div>
</template>
