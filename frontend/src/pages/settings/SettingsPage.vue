<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiNotification from "@/components/ui/UiNotification.vue";
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/composables/useNotifications';
import {
  getSlackIntegrationStatus,
  getSlackUserMappingStatus,
  unlinkSlackUser,
  type SlackIntegrationStatus,
} from '@/api/integrations';

const authStore = useAuthStore();
const route = useRoute();
const { info, error } = useNotifications();

const ORG_ID = computed(() => authStore.user?.organizationId ?? '');
const USER_ID = computed(() => authStore.user?.id ?? '');
const isAuthenticated = computed(() => !!authStore.user?.id);

const loading = ref(false);
const integrationStatus = ref<SlackIntegrationStatus | null>(null);
const userLinked = ref(false);
const userMapping = ref<any>(null);
const successMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

async function loadStatus() {
  try {
    loading.value = true;
    errorMessage.value = null;
    
    if (!ORG_ID.value || !USER_ID.value) {
      integrationStatus.value = null;
      loading.value = false;
      return;
    }

    integrationStatus.value = await getSlackIntegrationStatus(ORG_ID.value);
    
    // Load per-user mapping if integration is connected
    if (integrationStatus.value?.connected) {
      try {
        const m = await getSlackUserMappingStatus(ORG_ID.value, USER_ID.value);
        userLinked.value = !!m?.linked;
        userMapping.value = m?.mapping ?? null;
      } catch (err: any) {
        userLinked.value = false;
        userMapping.value = null;
      }
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to load integration status';
  } finally {
    loading.value = false;
  }
}

function linkSlackUser() {
  errorMessage.value = null;
  
  if (!ORG_ID.value || !USER_ID.value) {
    errorMessage.value = 'You must be signed in to link Slack.';
    return;
  }

  window.location.href = `/api/integrations/slack/user/start?organizationId=${encodeURIComponent(ORG_ID.value)}&userId=${encodeURIComponent(USER_ID.value)}`;
}

async function doUnlinkUser() {
  try {
    loading.value = true;
    if (!ORG_ID.value || !USER_ID.value) throw new Error('missing_auth');
    await unlinkSlackUser(ORG_ID.value, USER_ID.value);
    userLinked.value = false;
    userMapping.value = null;
    info('Slack account unlinked successfully');
  } catch (err: any) {
    error('Failed to unlink Slack user');
  } finally {
    loading.value = false;
  }
}

function dismissNotification() {
  errorMessage.value = null;
  successMessage.value = null;
}

onMounted(async () => {
  const success = route.query.success;
  const teamName = route.query.team;
  
  // Check for success first, delay status load if coming from OAuth
  if (success === 'slack_connected' && teamName) {
    // Give the database transaction time to commit
    await new Promise(resolve => setTimeout(resolve, 500));
    successMessage.value = `Successfully linked your Slack account`;
  }
  
  // Always load status
  await loadStatus();

  const urlError = route.query.error;
  if (urlError) {
    errorMessage.value = typeof urlError === 'string' ? urlError : 'Connection failed';
  }
});
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">User Settings</h1>
      <p class="text-sm text-base-content/60">
        Manage your personal preferences and integrations.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <UiCard>
        <div class="space-y-4">
          <div>
            <h2 class="text-sm font-semibold mb-1">Slack Account</h2>
            <p class="text-xs text-base-content/60">
              Link your personal Slack account to enable personalized features.
            </p>
          </div>

          <UiNotification
            v-if="errorMessage"
            type="error"
            :message="errorMessage"
            dismissable
            @dismiss="dismissNotification"
          />

          <UiNotification
            v-if="successMessage"
            type="success"
            :message="successMessage"
            dismissable
            @dismiss="dismissNotification"
          />

          <UiNotification
            v-if="!isAuthenticated"
            type="info"
            message="You must be signed in to link your Slack account."
          />

          <div v-if="loading" class="text-xs text-base-content/60">
            Loading...
          </div>

          <!-- Workspace not connected -->
          <div v-else-if="!integrationStatus?.connected" class="rounded-md bg-warning/10 p-3 space-y-2">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-warning mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div>
                <p class="text-sm font-medium text-warning mb-1">Workspace Not Connected</p>
                <p class="text-xs text-base-content/70">
                  Your organization's Slack workspace must be connected before you can link your account. 
                  Please ask an administrator to connect the workspace in Organization Settings.
                </p>
              </div>
            </div>
          </div>

          <!-- Workspace connected, user not linked -->
          <div v-else-if="!userLinked" class="space-y-3">
            <div class="rounded-md bg-info/10 p-3">
              <p class="text-xs text-base-content/70">
                Your organization's Slack workspace is connected. Link your personal Slack account to enable features like personalized notifications.
              </p>
            </div>
            <UiButton variant="primary" size="sm" @click="linkSlackUser" :disabled="loading || !isAuthenticated">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Link Your Slack Account
            </UiButton>
          </div>

          <!-- User linked -->
          <div v-else class="rounded-md bg-success/10 p-3 space-y-3">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm font-medium text-success">Linked</span>
            </div>
            <dl class="text-xs space-y-1">
              <div class="flex gap-2">
                <dt class="text-base-content/60">Slack User ID:</dt>
                <dd class="font-mono">{{ userMapping?.slackUserId }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-base-content/60">Linked at:</dt>
                <dd>{{ new Date(userMapping?.linkedAt).toLocaleString() }}</dd>
              </div>
            </dl>
            <UiButton variant="outline" size="sm" @click="doUnlinkUser" :disabled="loading">
              Unlink Account
            </UiButton>
          </div>
        </div>
      </UiCard>

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
