<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiNotification from "@/components/ui/UiNotification.vue";
import {
  getSlackIntegrationStatus,
  uninstallSlackIntegration,
  getSlackUserMappingStatus,
  unlinkSlackUser,
  type SlackIntegrationStatus
} from "@/api/integrations";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const ORG_ID = computed(() => authStore.user?.organizationId ?? "");
const USER_ID = computed(() => authStore.user?.id ?? "");
const isAuthenticated = computed(() => !!authStore.user?.id);

const route = useRoute();
const integrationStatus = ref<SlackIntegrationStatus | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const showConfirmUninstall = ref(false);
const userLinked = ref<boolean>(false);
const userMapping: any = ref(null);

async function loadStatus() {
  try {
    loading.value = true;
    error.value = null;
    if (!ORG_ID.value) {
      integrationStatus.value = null;
      return;
    }

    integrationStatus.value = await getSlackIntegrationStatus(ORG_ID.value);
    // load per-user mapping if integration is connected
    if (integrationStatus.value?.connected) {
      try {
        const m = await getSlackUserMappingStatus(ORG_ID.value, USER_ID.value);
        userLinked.value = !!m?.linked;
        userMapping.value = m?.mapping ?? null;
      } catch (err: any) {
        // non-fatal for UI
        userLinked.value = false;
        userMapping.value = null;
      }
    }
  } catch (err: any) {
    error.value = err.message || "Failed to load integration status";
  } finally {
    loading.value = false;
  }
}

async function connectSlack() {
  // Navigate the top-level window to the backend start endpoint so the
  // browser performs the OAuth redirect flow directly (avoids CORS issues
  // caused by using fetch/XHR for an endpoint that ultimately redirects
  // to Slack's OAuth URL).
  error.value = null;
  if (!ORG_ID.value || !USER_ID.value) {
    error.value = 'You must be signed in to connect Slack.';
    return;
  }

  // Instead of making an API call, directly navigate to the backend endpoint
  // which will initiate the OAuth flow and redirect to Slack
  window.location.href = `/api/integrations/slack/start?organizationId=${encodeURIComponent(ORG_ID.value)}&userId=${encodeURIComponent(USER_ID.value)}`;
}

async function linkSlackUser() {
  error.value = null;
  // Redirect to backend endpoint which will perform OAuth redirect
  if (!ORG_ID.value || !USER_ID.value) {
    error.value = 'You must be signed in to link Slack.';
    return;
  }

  // Instead of making an API call, directly navigate to the backend endpoint
  // which will initiate the OAuth flow and redirect to Slack
  window.location.href = `/api/integrations/slack/user/start?organizationId=${encodeURIComponent(ORG_ID.value)}&userId=${encodeURIComponent(USER_ID.value)}`;
}

async function doUnlinkUser() {
  try {
    loading.value = true;
    if (!ORG_ID.value || !USER_ID.value) throw new Error('missing_auth');
    await unlinkSlackUser(ORG_ID.value, USER_ID.value);
    userLinked.value = false;
    userMapping.value = null;
  } catch (err: any) {
    error.value = err.message || 'Failed to unlink Slack user';
  } finally {
    loading.value = false;
  }
}

async function confirmUninstall() {
  try {
    loading.value = true;
    error.value = null;
    if (!ORG_ID.value) throw new Error('missing_auth');
    await uninstallSlackIntegration(ORG_ID.value);
    successMessage.value = "Slack integration removed successfully";
    showConfirmUninstall.value = false;
    await loadStatus();
  } catch (err: any) {
    error.value = err.message || "Failed to uninstall integration";
  } finally {
    loading.value = false;
  }
}

function dismissNotification() {
  error.value = null;
  successMessage.value = null;
}

onMounted(async () => {
  // Wait for authStore to be populated; if no org, skip loading integration status
  await loadStatus();

  const urlError = route.query.error;
  if (urlError) {
    error.value = typeof urlError === 'string' ? urlError : 'Connection failed';
  }

  const success = route.query.success;
  const teamName = route.query.team;
  if (success === 'slack_connected' && teamName) {
    successMessage.value = `Successfully connected to Slack workspace: ${teamName}`;
    await loadStatus();
  }
});
</script>

<template>
  <UiCard>
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-semibold mb-1">Slack Integration</h2>
        <p class="text-xs text-base-content/60">
          Connect your Slack workspace to enable notifications, commands, and interactive features.
        </p>
      </div>

      <UiNotification
        v-if="error"
        type="error"
        :message="error"
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
        :message="'You must be signed in to connect or link Slack. Please sign in to continue.'"
        dismissable
        @dismiss="dismissNotification"
      />

      <div v-if="loading" class="text-xs text-base-content/60">
        Loading integration status...
      </div>

      <div v-else-if="integrationStatus?.connected && integrationStatus.integration" class="space-y-3">
        <div class="rounded-md bg-success/10 p-3 space-y-2">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium text-success">Connected</span>
          </div>

          <dl class="grid grid-cols-1 gap-2 text-xs">
            <div>
              <dt class="text-base-content/60">Workspace</dt>
              <dd class="font-medium">{{ integrationStatus.integration.teamName }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Team ID</dt>
              <dd class="font-mono text-xs">{{ integrationStatus.integration.teamId }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Installed by</dt>
              <dd>{{ integrationStatus.integration.installedBy.name || integrationStatus.integration.installedBy.email }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Installed at</dt>
              <dd>{{ new Date(integrationStatus.integration.installedAt).toLocaleString() }}</dd>
            </div>
            <div>
              <dt class="text-base-content/60">Scopes</dt>
              <dd class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="scope in integrationStatus.integration.scopes"
                  :key="scope"
                  class="inline-block px-2 py-0.5 rounded-full bg-base-200 text-xs"
                >
                  {{ scope }}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="!showConfirmUninstall" class="flex gap-2">
          <UiButton
            variant="outline"
            size="sm"
            @click="showConfirmUninstall = true"
            :disabled="loading || !isAuthenticated"
          >
            Disconnect
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            @click="connectSlack"
            :disabled="loading || !isAuthenticated"
          >
            Reinstall
          </UiButton>
          <div class="ml-4">
            <div v-if="userLinked" class="flex items-center gap-2">
              <span class="text-xs text-base-content/70">Linked Slack user:</span>
              <span class="font-mono text-xs">{{ userMapping?.slackUserId }}</span>
              <UiButton variant="outline" size="sm" @click="doUnlinkUser" :disabled="loading || !isAuthenticated">Unlink</UiButton>
            </div>
            <div v-else>
              <UiButton variant="primary" size="sm" @click="linkSlackUser" :disabled="loading || !isAuthenticated">Link your Slack account</UiButton>
            </div>
          </div>
        </div>

        <div v-else class="rounded-md bg-warning/10 p-3 space-y-3">
          <div>
            <p class="text-sm font-medium text-warning mb-1">Confirm Disconnect</p>
            <p class="text-xs text-base-content/70">
              This will remove the Slack integration. You can reconnect at any time.
            </p>
          </div>
          <div class="flex gap-2">
            <UiButton
              variant="error"
              size="sm"
              @click="confirmUninstall"
              :disabled="loading"
            >
              Confirm Disconnect
            </UiButton>
            <UiButton
              variant="outline"
              size="sm"
              @click="showConfirmUninstall = false"
            >
              Cancel
            </UiButton>
          </div>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div class="rounded-md bg-base-200 p-3 space-y-2">
          <p class="text-xs text-base-content/70">
            Connect your Slack workspace to enable:
          </p>
          <ul class="text-xs text-base-content/70 list-disc list-inside space-y-1 ml-2">
            <li>Incident notifications in Slack channels</li>
            <li>Interactive incident management</li>
            <li>Slash commands for quick actions</li>
            <li>Real-time status updates</li>
          </ul>
        </div>

        <div class="rounded-md bg-info/10 p-3">
          <p class="text-xs text-base-content/70">
            <strong>Required Permissions:</strong> The app will request chat:write, channels:read, and other permissions needed for full functionality.
          </p>
        </div>

        <UiButton
          variant="primary"
          size="sm"
          @click="connectSlack"
          :disabled="loading || !isAuthenticated"
        >
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
          Connect Slack Workspace
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
