<script setup lang="ts">
import UiCard from "@/components/ui/UiCard.vue";
import SlackIntegrationCard from "@/components/integrations/SlackIntegrationCard.vue";
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">Settings</h1>
      <p class="text-sm text-base-content/60">
        Configure Triage Tracker integrations and preferences.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlackIntegrationCard />

      <UiCard>
        <h2 class="text-sm font-semibold mb-2">Notification preferences</h2>
        <p class="text-xs text-base-content/60 mb-3">
          Control how and when alerts are escalated. This screen is a stub to guide future work.
        </p>
        <ul class="text-xs text-base-content/70 list-disc list-inside space-y-1">
          <li>Escalation policies</li>
          <li>On-call rotations</li>
          <li>Daily digest channels</li>
        </ul>
      </UiCard>
    </div>
  </section>
</template>
