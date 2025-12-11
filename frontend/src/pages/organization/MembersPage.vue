<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useNotifications } from "@/composables/useNotifications";
import * as orgsApi from "@/api/organizations";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiModal from "@/components/ui/UiModal.vue";
import UiConfirmDialog from "@/components/ui/UiConfirmDialog.vue";

const authStore = useAuthStore();
const { success, error } = useNotifications();

const members = ref<orgsApi.Member[]>([]);
const invites = ref<orgsApi.Invite[]>([]);
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
  } catch (err) {
    error("Failed to load members", { details: err instanceof Error ? err.message : "Unknown error" });
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
                <div v-if="authStore.isOwner && member.id !== authStore.user?.id">
                  <UiSelect v-model="selectedRoles[member.id]" @change="onSelectChange(member.id, selectedRoles[member.id])">
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Admin</option>
                  </UiSelect>
                </div>
                <div v-else>
                  <span :class="member.role === 'OWNER' ? 'badge badge-primary' : 'badge badge-secondary'">
                    {{ member.role === 'OWNER' ? 'Admin' : 'Member' }}
                  </span>
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
                <span :class="invite.role === 'OWNER' ? 'badge badge-primary' : 'badge badge-secondary'">
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
    <UiConfirmDialog
      v-model="showRoleChangeConfirm"
      title="Confirm Role Change"
      :message="pendingRoleChange ? `Change role for ${members.find(m => m.id === pendingRoleChange.userId)?.email || 'this member'} to ${pendingRoleChange.newRole === 'OWNER' ? 'Admin' : 'Member'}?` : ''"
      confirmLabel="Confirm"
      confirmVariant="primary"
      @confirm="confirmRoleChange"
    />

    <!-- Remove Member Confirmation Modal -->
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
