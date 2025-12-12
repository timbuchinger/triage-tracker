<script setup lang="ts">
import { onMounted, ref, computed, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useNotifications } from "@/composables/useNotifications";
import * as teamsApi from "@/api/teams";
import * as orgsApi from "@/api/organizations";
import * as integrationsApi from "@/api/integrations";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiModal from "@/components/ui/UiModal.vue";
import UiConfirmDialog from "@/components/ui/UiConfirmDialog.vue";
import type { Service } from "@/api/services";

const route = useRoute();
const authStore = useAuthStore();
const { info, error } = useNotifications();

let isUnmounted = false;
onUnmounted(() => {
  isUnmounted = true;
});

const teamId = computed(() => String(route.params.id || ""));
const team = ref<teamsApi.TeamDetail | null>(null);
const loading = ref(false);
const orgMembers = ref<orgsApi.Member[]>([]);
const slackMappings = ref<Record<string, boolean>>({});
const addMembersSelection = ref<string[]>([]);

const showRemoveMemberModal = ref(false);
const memberToRemoveId = ref<string | null>(null);

const showRemoveServiceModal = ref(false);
const serviceToRemove = ref<Service | null>(null);

const fetchTeam = async () => {
  if (!teamId.value) return;
  loading.value = true;
  try {
    const data = await teamsApi.getTeam(teamId.value);
    if (isUnmounted) return;
    team.value = data;
    // Normalize missing arrays from the API to avoid runtime render errors
    if (team.value) {
      if (!team.value.members) team.value.members = [];
      if (!team.value.services) team.value.services = [];
    }

    // Fetch Slack mappings for team members
    await fetchSlackMappings();
  } catch (err) {
    if (isUnmounted) return;
    error("Failed to load team", { details: err instanceof Error ? err.message : "Unknown" });
  } finally {
    // Only set loading to false if the component is still mounted.
    // This prevents a potential memory leak if the component is unmounted
    // before the async operation completes.
    if (!isUnmounted) {
      loading.value = false;
    }
  }
};

const fetchSlackMappings = async () => {
  if (!authStore.user?.organizationId || !team.value?.members) return;

  try {
    const mappingPromises = team.value.members.map(async (member) => {
      try {
        const status = await integrationsApi.getSlackUserMappingStatus(
          authStore.user!.organizationId,
          member.user.id
        );
        return { userId: member.user.id, linked: status.linked };
      } catch {
        return { userId: member.user.id, linked: false };
      }
    });

    const results = await Promise.all(mappingPromises);
    slackMappings.value = Object.fromEntries(
      results.map(r => [r.userId, r.linked])
    );
  } catch (err) {
    // Non-fatal, just won't show Slack status
    console.warn('Failed to load Slack mappings:', err);
  }
};

const fetchOrgMembers = async () => {
  if (!authStore.user?.organizationId) return;
  try {
    const data = await orgsApi.getMembers(authStore.user.organizationId);
    if (isUnmounted) return;
    orgMembers.value = data;
  } catch (err) {
    if (isUnmounted) return;
    error("Failed to load organization members", { details: err instanceof Error ? err.message : "Unknown" });
  }
};

const handleAddMembers = async () => {
  if (!teamId.value || addMembersSelection.value.length === 0) return;
  try {
    await teamsApi.addMembers(teamId.value, addMembersSelection.value);
    if (isUnmounted) return;
    info("Members added");
    addMembersSelection.value = [];
    await fetchTeam();
  } catch (err) {
    if (isUnmounted) return;
    error("Failed to add members", { details: err instanceof Error ? err.message : "Unknown" });
  }
};

const handleRemoveMember = async (userId: string) => {
  if (!teamId.value) return;
  // Prevent removing last member from default team (frontend guard; backend enforces too)
  if (team.value?.isDefault && team.value.members.length === 1) {
    error('Cannot remove the last member from the default team');
    return;
  }
  memberToRemoveId.value = userId;
  showRemoveMemberModal.value = true;
};

const confirmRemoveMember = async () => {
  if (!teamId.value || !memberToRemoveId.value) return;
  try {
    await teamsApi.removeMember(teamId.value, memberToRemoveId.value);
    if (isUnmounted) return;
    info("Member removed");
    await fetchTeam();
  } catch (err) {
    if (isUnmounted) return;
    error("Failed to remove member", { details: err instanceof Error ? err.message : "Unknown" });
  } finally {
    showRemoveMemberModal.value = false;
    memberToRemoveId.value = null;
  }
};

const handleSetPrimary = async (userId: string) => {
  if (!teamId.value) return;
  try {
    await teamsApi.updateTeam(teamId.value, { primaryContactId: userId });
    if (isUnmounted) return;
    info('Primary contact updated');
    await fetchTeam();
  } catch (err) {
    if (isUnmounted) return;
    error('Failed to set primary contact', { details: err instanceof Error ? err.message : 'Unknown' });
  }
};

const handleSetSecondary = async (userId: string) => {
  if (!teamId.value) return;
  try {
    await teamsApi.updateTeam(teamId.value, { secondaryContactId: userId });
    if (isUnmounted) return;
    info('Secondary contact updated');
    await fetchTeam();
  } catch (err) {
    if (isUnmounted) return;
    error('Failed to set secondary contact', { details: err instanceof Error ? err.message : 'Unknown' });
  }
};

const handleRemoveService = (service: Service) => {
  serviceToRemove.value = service;
  showRemoveServiceModal.value = true;
};

const confirmRemoveService = async () => {
  if (!teamId.value || !serviceToRemove.value) return;

  const currentServiceIds = team.value?.services.map(s => s.id) ?? [];
  const newServiceIds = currentServiceIds.filter(id => id !== serviceToRemove.value?.id);

  try {
    await teamsApi.updateTeam(teamId.value, { serviceIds: newServiceIds });
    if (isUnmounted) return;
    info("Service removed from team");
    await fetchTeam();
  } catch (err) {
    if (isUnmounted) return;
    error("Failed to remove service", { details: err instanceof Error ? err.message : "Unknown" });
  } finally {
    showRemoveServiceModal.value = false;
    serviceToRemove.value = null;
  }
};

const availableMembers = computed(() => {
  const teamMemberIds = new Set(team.value?.members.map(m => m.user.id));
  return orgMembers.value.filter(om => !teamMemberIds.has(om.id));
});

// Fetch whenever the route team id changes (also runs immediately for current id)
watch(
  teamId,
  async (id) => {
    if (!id) return;
    await fetchTeam();
  },
  { immediate: true }
);

onMounted(async () => {
  await fetchOrgMembers();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Team</h1>
      <UiButton variant="ghost" @click="$router.back()">Back</UiButton>
    </div>

    <UiCard v-if="team">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div>
            <h2 class="text-xl font-semibold">{{ team.name }}</h2>
            <div class="text-sm text-base-content/60">ID: {{ team.id }}</div>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <div>
          <strong>Primary:</strong> {{ team.primaryContact?.email || '—' }}
        </div>
        <div>
          <strong>Secondary:</strong> {{ team.secondaryContact?.email || '—' }}
        </div>

        <div>
          <h3 class="text-lg font-semibold">Members</h3>
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Slack</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="(team.members ?? []).length === 0">
                  <td colspan="5" class="text-center text-base-content/60">No members in this team.</td>
                </tr>
                <tr v-for="m in team.members ?? []" :key="m.user.id">
                  <td>{{ m.user.email }}</td>
                  <td>{{ m.user.name || '—' }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span v-if="team.primaryContact && team.primaryContact.id === m.user.id" class="badge badge-success">Primary</span>
                      <span v-else-if="team.secondaryContact && team.secondaryContact.id === m.user.id" class="badge badge-warning">Secondary</span>
                      <span v-else class="text-sm text-base-content/60">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="flex items-center justify-center">
                      <svg v-if="slackMappings[m.user.id]" class="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      <span v-else class="text-base-content/30">—</span>
                    </div>
                  </td>
                  <td class="space-x-2">
                    <UiButton size="sm" @click="handleSetPrimary(m.user.id)" :disabled="team.primaryContact && team.primaryContact.id === m.user.id">Set Primary</UiButton>
                    <UiButton size="sm" variant="ghost" @click="handleSetSecondary(m.user.id)" :disabled="team.secondaryContact && team.secondaryContact.id === m.user.id">Set Secondary</UiButton>
                    <UiButton size="sm" variant="error" @click="handleRemoveMember(m.user.id)" :disabled="team.isDefault && (team.members ?? []).length === 1">Remove</UiButton>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="team.isDefault && (team.members ?? []).length === 1" class="mt-2 text-sm text-base-content/60">
              The default team must always include at least one member; you cannot remove the last member.
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mt-6">Add Members</h3>
          <div class="flex items-center gap-2">
            <UiSelect v-model="addMembersSelection" multiple>
              <option v-for="m in availableMembers" :key="m.id" :value="m.id">{{ m.email }}</option>
            </UiSelect>
            <UiButton @click="handleAddMembers">Add</UiButton>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mt-6">
            <h3 class="text-lg font-semibold">Services</h3>
            <router-link :to="{ name: 'services' }" class="text-sm text-base-content/60 hover:underline">(view all)</router-link>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="team.services.length === 0">
                  <td colspan="2" class="text-center text-base-content/60">No services owned by this team.</td>
                </tr>
                <tr v-for="service in team.services" :key="service.id">
                  <td>{{ service.name }}</td>
                  <td>
                    <UiButton size="sm" variant="error" @click="handleRemoveService(service)">Remove</UiButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </UiCard>

    <div v-else-if="loading">Loading...</div>
  </div>

  <UiConfirmDialog
    v-model="showRemoveServiceModal"
    title="Remove Service"
    :message="serviceToRemove ? `Are you sure you want to remove '${serviceToRemove.name}' from this team?` : ''"
    confirmLabel="Remove"
    confirmVariant="error"
    @confirm="confirmRemoveService"
  />

  <UiConfirmDialog
    v-model="showRemoveMemberModal"
    title="Remove Member"
    :message="memberToRemoveId ? 'Are you sure you want to remove this member from the team?' : ''"
    confirmLabel="Remove"
    confirmVariant="error"
    @confirm="confirmRemoveMember"
  />
</template>
