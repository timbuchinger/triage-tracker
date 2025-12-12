<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import UiCard from '@/components/ui/UiCard.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiModal from '@/components/ui/UiModal.vue';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/auth';
import {
  getSlackIntegrationStatus,
  uninstallSlackIntegration,
  type SlackIntegrationStatus,
} from '@/api/integrations';

const authStore = useAuthStore();
const { info, error } = useNotifications();

const ORG_ID = computed(() => authStore.user?.organizationId ?? '');
const USER_ID = computed(() => authStore.user?.id ?? '');

const loading = ref(false);
const integrationStatus = ref<SlackIntegrationStatus | null>(null);
const showConnectModal = ref(false);
const showDisconnectModal = ref(false);

async function loadStatus() {
  loading.value = true;
  try {
    if (!ORG_ID.value) {
      integrationStatus.value = null;
      return;
    }

    integrationStatus.value = await getSlackIntegrationStatus(ORG_ID.value);
  } catch (err: any) {
    console.error('Failed to load integration status:', err);
  } finally {
    loading.value = false;
  }
}

function handleConnect() {
  showConnectModal.value = true;
}

function proceedToSlack() {
  if (!ORG_ID.value || !USER_ID.value) {
    error('Authentication required');
    return;
  }

  // Navigate to backend OAuth start endpoint
  window.location.href = `/api/integrations/slack/start?organizationId=${encodeURIComponent(ORG_ID.value)}&userId=${encodeURIComponent(USER_ID.value)}`;
}

function handleDisconnect() {
  showDisconnectModal.value = true;
}

async function confirmDisconnect() {
  try {
    loading.value = true;
    if (!ORG_ID.value) throw new Error('missing_org');
    await uninstallSlackIntegration(ORG_ID.value);
    info('Slack workspace disconnected successfully');
    integrationStatus.value = null;
  } catch (err: any) {
    error('Failed to disconnect Slack workspace');
  } finally {
    loading.value = false;
    showDisconnectModal.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

onMounted(() => {
  loadStatus();

  // Check for OAuth callback result
  const params = new URLSearchParams(window.location.search);
  if (params.get('success')) {
    info(`Successfully connected to ${params.get('team')}`);
    loadStatus();
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('error')) {
    error(`Failed to connect: ${params.get('error')}`);
    window.history.replaceState({}, '', window.location.pathname);
  }
});
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">Organization Settings</h1>
      <p class="text-sm text-base-content/60">
        Manage organization-wide integrations and configurations.
      </p>
    </div>

    <UiCard>
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            Slack Workspace
          </h2>
          <p class="text-sm text-base-content/60 mt-1">
            Connect your Slack workspace to enable incident notifications, slash commands, and interactive workflows for all users.
          </p>
        </div>
      </div>

      <div v-if="loading" class="py-8 text-center text-sm text-base-content/60">
        Loading integration status...
      </div>

      <div v-else-if="integrationStatus?.connected && integrationStatus.integration" class="space-y-4">
        <div class="rounded-lg border border-success/20 bg-success/5 p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="badge badge-success badge-sm">Connected</span>
                <span class="font-semibold">{{ integrationStatus.integration.teamName }}</span>
              </div>
              <dl class="text-sm space-y-1">
                <div class="flex gap-2">
                  <dt class="text-base-content/60">Team ID:</dt>
                  <dd class="font-mono">{{ integrationStatus.integration.teamId }}</dd>
                </div>
                <div class="flex gap-2">
                  <dt class="text-base-content/60">Installed by:</dt>
                  <dd>{{ integrationStatus.integration.installedBy.name || integrationStatus.integration.installedBy.email }}</dd>
                </div>
                <div class="flex gap-2">
                  <dt class="text-base-content/60">Installed at:</dt>
                  <dd>{{ formatDate(integrationStatus.integration.installedAt) }}</dd>
                </div>
                <div class="flex gap-2 items-start">
                  <dt class="text-base-content/60">Scopes:</dt>
                  <dd>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="scope in integrationStatus.integration.scopes"
                        :key="scope"
                        class="badge badge-xs badge-ghost"
                      >
                        {{ scope }}
                      </span>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
            <UiButton variant="ghost" size="sm" @click="handleDisconnect">
              Disconnect
            </UiButton>
          </div>
        </div>

        <div class="text-sm text-base-content/60">
          <p class="mb-2"><strong>What's enabled:</strong></p>
          <ul class="list-disc list-inside space-y-1">
            <li>Incident notifications in Slack channels</li>
            <li>Slash commands for creating incidents</li>
            <li>Interactive status updates and workflows</li>
            <li>Thumbs-up reaction tracking in timelines</li>
          </ul>
          <p class="mt-3 text-xs">
            Users can now link their individual Slack accounts in User Settings.
          </p>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="rounded-lg border border-base-300 p-4 text-center">
          <p class="text-base-content/60 mb-4">
            No Slack workspace connected. Connect your workspace to enable Slack integrations for all users.
          </p>
          <UiButton variant="primary" @click="handleConnect">
            Connect Slack Workspace
          </UiButton>
        </div>
      </div>
    </UiCard>

    <!-- Connect Modal -->
    <UiModal v-model="showConnectModal" title="Connect Slack Workspace">
      <div class="space-y-4">
        <p class="text-sm">
          You'll be redirected to Slack to authorize the following permissions for the Triage Tracker app:
        </p>

        <div class="bg-base-200 rounded-lg p-3">
          <p class="text-xs font-semibold mb-2">Requested Permissions:</p>
          <ul class="text-xs space-y-1 list-disc list-inside">
            <li>Post messages to channels</li>
            <li>Read channel information</li>
            <li>Read user information</li>
            <li>Access slash commands</li>
            <li>Read reactions and message history</li>
          </ul>
        </div>

        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm">This installs the Slack app for your entire workspace.</span>
        </div>
      </div>

      <template #actions>
        <UiButton variant="ghost" @click="showConnectModal = false">
          Cancel
        </UiButton>
        <UiButton variant="primary" @click="proceedToSlack">
          Proceed to Slack
        </UiButton>
      </template>
    </UiModal>

    <!-- Disconnect Modal -->
    <UiModal v-model="showDisconnectModal" title="Disconnect Slack Workspace">
      <p class="text-sm">
        Are you sure you want to disconnect this Slack workspace? This will affect all users in your organization.
      </p>
      <template #actions>
        <UiButton variant="ghost" @click="showDisconnectModal = false">Cancel</UiButton>
        <UiButton variant="error" @click="confirmDisconnect">Disconnect</UiButton>
      </template>
    </UiModal>
  </section>
</template>
