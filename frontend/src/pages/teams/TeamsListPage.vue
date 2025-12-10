<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useNotifications } from "@/composables/useNotifications";
import * as teamsApi from "@/api/teams";
import * as orgsApi from "@/api/organizations";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const { success, error } = useNotifications();
const router = useRouter();

const teams = ref<teamsApi.TeamSummary[]>([]);
const loading = ref(false);
const showCreate = ref(false);

const createForm = reactive({ name: "", isDefault: false, memberIds: [] as string[], primaryContactId: null as string | null, secondaryContactId: null as string | null });
const orgMembers = ref<orgsApi.Member[]>([]);

const fetchTeams = async () => {
  if (!authStore.user?.organizationId) return;
  try {
    teams.value = await teamsApi.listTeams(authStore.user.organizationId);
  } catch (err) {
    error("Failed to load teams", { details: err instanceof Error ? err.message : "Unknown" });
  }
};

const fetchOrgMembers = async () => {
  if (!authStore.user?.organizationId) return;
  try {
    orgMembers.value = await orgsApi.getMembers(authStore.user.organizationId);
  } catch (err) {
    error("Failed to load organization members", { details: err instanceof Error ? err.message : "Unknown" });
  }
};

const handleCreate = async () => {
  if (!authStore.user?.organizationId) return;
  if (!createForm.name) {
    error("Team name is required");
    return;
  }

  loading.value = true;
  try {
    await teamsApi.createTeam({ name: createForm.name, organizationId: authStore.user.organizationId, isDefault: createForm.isDefault, primaryContactId: createForm.primaryContactId ?? undefined, secondaryContactId: createForm.secondaryContactId ?? undefined, memberIds: createForm.memberIds });
    success("Team created");
    showCreate.value = false;
    createForm.name = "";
    createForm.memberIds = [];
    await fetchTeams();
  } catch (err) {
    error("Failed to create team", { details: err instanceof Error ? err.message : "Unknown" });
  } finally {
    loading.value = false;
  }
};

const goToTeam = (id: string) => router.push({ name: "teams-detail", params: { id } });

onMounted(async () => {
  await fetchTeams();
  await fetchOrgMembers();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Teams</h1>
      <UiButton variant="primary" @click="showCreate = true">Create Team</UiButton>
    </div>

    <UiCard>
      <template #header>
        <h2 class="text-xl font-semibold">Teams</h2>
      </template>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Default</th>
              <th>Services</th>
              <th>Incidents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in teams" :key="t.id">
              <td><a class="link" @click.prevent="goToTeam(t.id)">{{ t.name }}</a></td>
              <td>{{ t.isDefault ? 'Yes' : 'No' }}</td>
              <td>{{ t._count?.services ?? 0 }}</td>
              <td>{{ t._count?.incidents ?? 0 }}</td>
              <td>
                <UiButton size="sm" @click="goToTeam(t.id)">View</UiButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- Create Team Modal -->
    <dialog class="modal" :open="showCreate" @click.self="showCreate = false">
      <UiCard class="modal-box">
        <template #header>
          <h3 class="text-lg font-bold">Create Team</h3>
        </template>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <UiFormField label="Name" required>
            <UiInput v-model="createForm.name" placeholder="Team name" />
          </UiFormField>

          <UiFormField label="Primary Contact">
            <UiSelect v-model="createForm.primaryContactId">
              <option :value="null">—</option>
              <option v-for="m in orgMembers" :key="m.id" :value="m.id">{{ m.email }}</option>
            </UiSelect>
          </UiFormField>

          <UiFormField label="Secondary Contact">
            <UiSelect v-model="createForm.secondaryContactId">
              <option :value="null">—</option>
              <option v-for="m in orgMembers" :key="m.id" :value="m.id">{{ m.email }}</option>
            </UiSelect>
          </UiFormField>

          <UiFormField label="Members">
            <UiSelect v-model="createForm.memberIds" multiple>
              <option v-for="m in orgMembers" :key="m.id" :value="m.id">{{ m.email }}</option>
            </UiSelect>
          </UiFormField>

          <div class="flex justify-end gap-2">
            <UiButton variant="ghost" @click="showCreate = false">Cancel</UiButton>
            <UiButton type="submit" variant="primary">Create</UiButton>
          </div>
        </form>
      </UiCard>
    </dialog>
  </div>
</template>
