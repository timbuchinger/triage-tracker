<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiTextarea from "@/components/ui/UiTextarea.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import { createIncident, IncidentSeverity } from "@/api/incidents";
import { getServices, type Service } from "@/api/services";
import { useNotifications } from "@/composables/useNotifications";

const router = useRouter();
const { info, error } = useNotifications();

const form = reactive({
  title: "",
  description: "",
  severity: "HIGH",
  serviceId: ""
});

const services = ref<Service[]>([]);
const errors = reactive<Record<string, string>>({});
const loading = ref(false);

onMounted(async () => {
  try {
    services.value = await getServices();
  } catch (err) {
    console.error("Failed to load services", err);
  }
});

const submit = async () => {
  form.title = form.title.trim();
  form.description = form.description.trim();
  errors.title = form.title ? "" : "Title is required";
  if (errors.title) {
    error("Please fix the form errors");
    return;
  }

  loading.value = true;
  try {
    const created = await createIncident({
      title: form.title,
      description: form.description || undefined,
      severity: form.severity as IncidentSeverity,
      serviceId: form.serviceId || undefined
    });
    info("Incident created successfully");
    // Navigate to the newly created incident's detail page
    router.push({ name: "incident-detail", params: { id: created.refId } });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create incident";
    error("Failed to create incident", { details: errorMessage });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">Create incident</h1>
        <p class="text-sm text-base-content/60">
          Open a new incident and route it through Triage Tracker workflows.
        </p>
      </div>
    </div>

    <UiCard>
      <form class="space-y-4" @submit.prevent="submit">
        <UiFormField
          label="Title"
          id="title"
          :required="true"
          :error="errors.title"
        >
          <UiInput
            id="title"
            v-model="form.title"
            type="text"
            placeholder="API error rates spiking in production"
          />
        </UiFormField>

        <UiFormField
          label="Description"
          id="description"
          hint="Provide enough context for on-call engineers."
        >
          <UiTextarea
            id="description"
            v-model="form.description"
            rows="4"
            placeholder="Describe the impact, timeframe, and any known clues..."
          />
        </UiFormField>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiFormField label="Severity" id="severity">
            <UiSelect id="severity" v-model="form.severity">
              <option disabled value="">Select severity</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </UiSelect>
          </UiFormField>

          <UiFormField label="Service (optional)" id="service">
            <UiSelect id="service" v-model="form.serviceId">
              <option value="">Select service</option>
              <option v-for="service in services" :key="service.id" :value="service.id">
                {{ service.name }}
              </option>
            </UiSelect>
          </UiFormField>
        </div>

        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="ghost" @click="router.back()">
            Cancel
          </UiButton>
          <UiButton type="submit" variant="primary" :disabled="loading">
            Create incident
          </UiButton>
        </div>
      </form>
    </UiCard>
  </section>
</template>
