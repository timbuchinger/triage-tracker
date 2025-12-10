<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiModal from "@/components/ui/UiModal.vue";
import { getServices, createService, deleteService, updateService, type Service } from "@/api/services";
import { listTeams, type TeamSummary } from "@/api/teams";
import { useNotifications } from "@/composables/useNotifications";
import { useAuthStore } from "@/stores/auth";

const { info, error } = useNotifications();
const authStore = useAuthStore();
const services = ref<Service[]>([]);
const teams = ref<TeamSummary[]>([]);
const newServiceName = ref("");
const newServiceTeamId = ref("");
const loading = ref(false);
const editingService = ref<Service | null>(null);

const loadServices = async () => {
  try {
    services.value = await getServices();
  } catch (err) {
    error("Failed to load services");
  }
};

const loadTeams = async (organizationId: string) => {
  try {
    teams.value = await listTeams(organizationId);
    const defaultTeam = teams.value.find((team) => team.name === "Default");
    if (defaultTeam) {
      newServiceTeamId.value = defaultTeam.id;
    } else if (teams.value.length > 0) {
      newServiceTeamId.value = teams.value[0].id;
    }
  } catch (err) {
    error("Failed to load teams");
  }
};

onMounted(async () => {
  const orgId = authStore.user?.organizationId;
  if (orgId) {
    await loadServices();
    await loadTeams(orgId);
  }
});

watch(
  () => authStore.user?.organizationId,
  async (newOrganizationId) => {
    if (newOrganizationId) {
      await loadServices();
      await loadTeams(newOrganizationId);
    }
  },
  { immediate: true }
);

const teamOptions = computed(() => {
  return teams.value.map((team) => ({
    label: team.name,
    value: team.id
  }));
});

const addService = async () => {
  if (!newServiceName.value.trim()) {
    error("Service name cannot be empty");
    return;
  }
  if (newServiceName.value.includes(" ")) {
    error("Service name cannot contain spaces");
    return;
  }
  if (newServiceName.value.length > 50) {
    error("Service name cannot be longer than 50 characters");
    return;
  }
  if (!newServiceTeamId.value) {
    error("Please select a team for the service");
    return;
  }

  loading.value = true;
  try {
    await createService({
      name: newServiceName.value.trim(),
      teamId: newServiceTeamId.value
    });
    newServiceName.value = "";
    info("Service added successfully");
    await loadServices();
  } catch (err) {
    error("Failed to add service");
  } finally {
    loading.value = false;
  }
};

const showRemoveServiceModal = ref(false);
const serviceToRemove = ref<Service | null>(null);

const promptRemoveService = (service: Service) => {
  serviceToRemove.value = service;
  showRemoveServiceModal.value = true;
};

const confirmRemoveService = async () => {
  if (!serviceToRemove.value) return;
  try {
    await deleteService(serviceToRemove.value.id);
    info("Service removed successfully");
    await loadServices();
  } catch (err) {
    error("Failed to remove service");
  } finally {
    showRemoveServiceModal.value = false;
    serviceToRemove.value = null;
  }
};

const startEditing = (service: Service) => {
  editingService.value = { ...service };
};

const cancelEditing = () => {
  editingService.value = null;
};

const saveService = async () => {
  if (!editingService.value) return;

  if (!editingService.value.name.trim()) {
    error("Service name cannot be empty");
    return;
  }
  if (editingService.value.name.includes(" ")) {
    error("Service name cannot contain spaces");
    return;
  }
  if (editingService.value.name.length > 50) {
    error("Service name cannot be longer than 50 characters");
    return;
  }
  if (!editingService.value.teamId) {
    error("Please select a team for the service");
    return;
  }

  loading.value = true;
  try {
    await updateService(editingService.value.id, {
      name: editingService.value.name.trim(),
      teamId: editingService.value.teamId
    });
    info("Service updated successfully");
    editingService.value = null;
    await loadServices();
  } catch (err) {
    error("Failed to update service");
  } finally {
    loading.value = false;
  }
};

const getTeamName = (teamId: string) => {
  const team = teams.value.find((team) => team.id === teamId);
  return team ? team.name : "Unassigned";
};
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Services</h1>

    <UiCard class="mb-4">
      <h2 class="text-lg font-semibold mb-2">Add New Service</h2>
      <div class="flex gap-2">
        <UiFormField class="flex-1">
          <UiInput
            v-model="newServiceName"
            placeholder="Service name"
            @keyup.enter="addService"
          />
        </UiFormField>
        <UiFormField class="flex-1">
          <UiSelect v-model="newServiceTeamId">
            <option v-for="opt in teamOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </UiSelect>
        </UiFormField>
        <UiButton
          variant="primary"
          :disabled="loading"
          @click="addService"
        >
          Add Service
        </UiButton>
      </div>
    </UiCard>

    <UiCard>
      <h2 class="text-lg font-semibold mb-2">Existing Services</h2>
      <div v-if="services.length" class="space-y-2">
        <div
          v-for="service in services"
          :key="service.id"
          class="flex items-center justify-between p-2 bg-base-200 rounded"
        >
          <div v-if="editingService && editingService.id === service.id" class="flex gap-2 w-full">
            <UiInput v-model="editingService.name" class="flex-1" />
            <UiSelect v-model="editingService.teamId" class="flex-1">
              <option v-for="opt in teamOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </UiSelect>
            <UiButton variant="primary" @click="saveService" :disabled="loading">Save</UiButton>
            <UiButton variant="ghost" @click="cancelEditing">Cancel</UiButton>
          </div>
          <div v-else class="flex items-center justify-between w-full">
            <div>
              <span class="text-sm font-medium">{{ service.name }}</span>
              <span class="text-xs text-base-content/60 ml-2">({{ getTeamName(service.teamId) }})</span>
            </div>
            <div>
              <UiButton variant="ghost" size="sm" @click="startEditing(service)">Edit</UiButton>
              <UiButton variant="ghost" size="sm" @click="promptRemoveService(service)">Delete</UiButton>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-base-content/50">
        No services configured yet.
      </p>
    </UiCard>
  </div>
  <UiModal v-model="showRemoveServiceModal" title="Remove Service">
    <p v-if="serviceToRemove">Are you sure you want to remove "{{ serviceToRemove.name }}"?</p>
    <template #actions>
      <UiButton @click="showRemoveServiceModal = false">Cancel</UiButton>
      <UiButton variant="error" @click="confirmRemoveService">Remove</UiButton>
    </template>
  </UiModal>
</template>