<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useNotifications } from "@/composables/useNotifications";
import * as orgsApi from "@/api/organizations";
import * as integrationsApi from "@/api/integrations";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiModal from "@/components/ui/UiModal.vue";
import UiConfirmDialog from "@/components/ui/UiConfirmDialog.vue";
import RoleSelector from "@/components/RoleSelector.vue";
import { badges } from "@/design/tokens";

const authStore = useAuthStore();
const { success, error } = useNotifications();

const members = ref<orgsApi.Member[]>([]);
const invites = ref<orgsApi.Invite[]>([]);
const slackMappings = ref<Record<string, boolean>>({});
const loading = ref(false);
const showInviteModal = ref(false);
const showRoleChangeConfirm = ref(false);
const pendingRoleChange = ref<null | { userId: string; newRole: "OWNER" | "MEMBER"; oldRole: "OWNER" | "MEMBER" }>(null);

// track select state per member so we can revert if user cancels confirmation
const selectedRoles = reactive<Record<string, "OWNER" | "MEMBER">>({});

const inviteForm = ref({
  email: "",
  role: "MEMBER" as "OWNER" | "MEMBER",
});

const fetchMembers = async () => {
  if (!authStore.user?.organizationId) return;

  try {
    members.value = await orgsApi.getMembers(authStore.user.organizationId);
    // initialize selectedRoles map for dropdowns
    members.value.forEach((m) => {
      selectedRoles[m.id] = m.role;
    });
    
    // Fetch Slack mappings for all members
    await fetchSlackMappings();
  } catch (err) {
    error("Failed to load members", { details: err instanceof Error ? err.message : "Unknown error" });
  }
};

const fetchSlackMappings = async () => {
  if (!authStore.user?.organizationId) return;
  
  try {
    const mappingPromises = members.value.map(async (member) => {
      try {
        const status = await integrationsApi.getSlackUserMappingStatus(
          authStore.user!.organizationId,
          member.id
        );
        return { userId: member.id, linked: status.linked };
      } catch {
        return { userId: member.id, linked: false };
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

const fetchInvites = async () => {
  if (!authStore.user?.organizationId) return;

  try {
    invites.value = await orgsApi.listInvites(authStore.user.organizationId);
  } catch (err) {
    error("Failed to load invites", { details: err instanceof Error ? err.message : "Unknown error" });
  }
};

const handleRoleChange = async (userId: string, newRole: "OWNER" | "MEMBER") => {
  if (!authStore.user?.organizationId) return;

  try {
    await orgsApi.updateMemberRole(authStore.user.organizationId, userId, newRole);
    success("Role updated successfully");
    await fetchMembers();
  } catch (err) {
    error("Failed to update role", { details: err instanceof Error ? err.message : "Unknown error" });
  }
};

const onSelectChange = (userId: string, newRole: "OWNER" | "MEMBER") => {
  const oldRole = selectedRoles[userId];
  if (oldRole === newRole) return;
  pendingRoleChange.value = { userId, newRole, oldRole };
  showRoleChangeConfirm.value = true;
};

const confirmRoleChange = async () => {
  if (!pendingRoleChange.value) return;
  const { userId, newRole } = pendingRoleChange.value;
  showRoleChangeConfirm.value = false;
  try {
    await handleRoleChange(userId, newRole);
  } finally {
    pendingRoleChange.value = null;
  }
};

const cancelRoleChange = () => {
  if (!pendingRoleChange.value) return;
  // revert selection
  selectedRoles[pendingRoleChange.value.userId] = pendingRoleChange.value.oldRole;
  pendingRoleChange.value = null;
  showRoleChangeConfirm.value = false;
};

const showRemoveMemberModal = ref(false);
const memberToRemoveId = ref<string | null>(null);
const memberToRemoveEmail = ref<string | null>(null);

const handleRemoveMember = async (userId: string, email: string) => {
  if (!authStore.user?.organizationId) return;
  memberToRemoveId.value = userId;
  memberToRemoveEmail.value = email;
  showRemoveMemberModal.value = true;
};

const confirmRemoveMember = async () => {
  if (!authStore.user?.organizationId || !memberToRemoveId.value) return;
  try {
    await orgsApi.removeMember(authStore.user.organizationId, memberToRemoveId.value);
    success("Member removed successfully");
    await fetchMembers();
  } catch (err) {
    error("Failed to remove member", { details: err instanceof Error ? err.message : "Unknown error" });
  } finally {
    showRemoveMemberModal.value = false;
    memberToRemoveId.value = null;
    memberToRemoveEmail.value = null;
  }
};

const handleInvite = async () => {
  if (!authStore.user?.organizationId) return;
  if (!inviteForm.value.email) {
    error("Email is required");
    return;
  }

  loading.value = true;

  try {
    const result = await orgsApi.createInvite(authStore.user.organizationId, inviteForm.value);
    success("Invite sent successfully");
    console.log("Invite URL (check server console):", result.inviteUrl);

    showInviteModal.value = false;
    inviteForm.value = { email: "", role: "MEMBER" };

    await fetchInvites();
  } catch (err) {
    error("Failed to create invite", { details: err instanceof Error ? err.message : "Unknown error" });
  } finally {
    loading.value = false;
  }
};

const formatDate = (isoString: string) =>
  new Date(isoString).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

onMounted(async () => {
  await fetchMembers();
  await fetchInvites();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Organization Members</h1>
      <UiButton v-if="authStore.isOwner" variant="primary" @click="showInviteModal = true">
        Invite Member
      </UiButton>
    </div>

    <!-- Members List -->
    <UiCard>
      <template #header>
        <h2 class="text-xl font-semibold">Members</h2>
      </template>

      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Slack</th>
              <th>Joined</th>
              <th>Last Login</th>
              <th v-if="authStore.isOwner">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in members" :key="member.id">
              <td>{{ member.email }}</td>
              <td>{{ member.name || "—" }}</td>
              <td>
                <RoleSelector
                  v-if="authStore.isOwner && member.id !== authStore.user?.id"
                  v-model="selectedRoles[member.id]"
                  @update:model-value="onSelectChange(member.id, $event)"
                />
                <span
                  v-else
                  :class="member.role === 'OWNER' ? badges.roleOwner : badges.roleMember"
                >
                  {{ member.role === 'OWNER' ? 'Admin' : 'Member' }}
                </span>
              </td>
              <td>
                <div class="flex items-center justify-center">
                  <svg v-if="slackMappings[member.id]" class="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  <span v-else class="text-base-content/30">—</span>
                </div>
              </td>
              <td>{{ formatDate(member.createdAt) }}</td>
              <td>{{ member.lastLogin ? formatDate(member.lastLogin) : '—' }}</td>
              <td v-if="authStore.isOwner" class="space-x-2">
                <UiButton
                  v-if="member.id !== authStore.user?.id"
                  variant="error"
                  size="sm"
                  @click="handleRemoveMember(member.id, member.email)"
                >
                  Remove
                </UiButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- Pending Invites -->
    <UiCard v-if="authStore.isOwner && invites.length > 0">
      <template #header>
        <h2 class="text-xl font-semibold">Pending Invites</h2>
      </template>

      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invite in invites" :key="invite.id">
              <td>{{ invite.email }}</td>
              <td>
                <span :class="invite.role === 'OWNER' ? badges.roleOwner : badges.roleMember">
                  {{ invite.role === 'OWNER' ? 'Admin' : 'Member' }}
                </span>
              </td>
              <td>{{ formatDate(invite.expiresAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- Invite Modal -->
    <UiModal v-model="showInviteModal" title="Invite New Member">
      <form @submit.prevent="handleInvite" class="space-y-4">
          <UiFormField label="Email" required>
            <UiInput
              v-model="inviteForm.email"
              type="email"
              placeholder="user@example.com"
              :disabled="loading"
            />
          </UiFormField>

          <UiFormField label="Role" required>
            <UiSelect v-model="inviteForm.role" :disabled="loading">
              <option value="MEMBER">Member</option>
              <option value="OWNER">Owner</option>
            </UiSelect>
          </UiFormField>

          <div class="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="text-sm">The invite link will be printed to the server console (mock email)</span>
          </div>

          <div class="flex justify-end gap-2">
            <UiButton type="button" variant="ghost" @click="showInviteModal = false" :disabled="loading">
              Cancel
            </UiButton>
            <UiButton type="submit" variant="primary" :disabled="loading">
              {{ loading ? "Sending..." : "Send Invite" }}
            </UiButton>
          </div>
      </form>
    </UiModal>

    <!-- Role Change Confirmation Modal -->
    <UiModal v-model="showRoleChangeConfirm" title="Confirm Role Change">
      <div class="space-y-4">
        <p>
          Change role for
          <strong>{{ members.find(m => m.id === (pendingRoleChange && pendingRoleChange.userId))?.email || 'this member' }}</strong>
          to
          <strong>{{ pendingRoleChange ? (pendingRoleChange.newRole === 'OWNER' ? 'Admin' : 'Member') : '' }}</strong>?
        </p>

        <div class="flex justify-end gap-2">
          <UiButton variant="ghost" @click="cancelRoleChange">Cancel</UiButton>
          <UiButton variant="primary" @click="confirmRoleChange">Confirm</UiButton>
        </div>
      </div>
    </UiModal>

    <!-- Remove Member Confirmation -->
    <UiConfirmDialog
      v-model="showRemoveMemberModal"
      title="Remove Member"
      :message="memberToRemoveEmail ? `Are you sure you want to remove '${memberToRemoveEmail}' from the organization?` : ''"
      confirmLabel="Remove"
      confirmVariant="error"
      @confirm="confirmRemoveMember"
    />
  </div>
</template>
