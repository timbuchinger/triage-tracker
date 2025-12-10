<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiTextarea from "@/components/ui/UiTextarea.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiSkeleton from "@/components/ui/UiSkeleton.vue";
import { getIncident, IncidentWithRelations, generateSummary, updateSummary, updateIncident, updateIncidentStatus } from "@/api/incidents";
import { type Service } from "@/api/teams";
import { useNotifications } from "@/composables/useNotifications";

const route = useRoute();
const router = useRouter();
const { info, error } = useNotifications();

const refId = computed(() => route.params.id as string);
const incident = ref<IncidentWithRelations | null>(null);
const services = ref<Service[]>([]);
const loading = ref(false);
const generating = ref(false);
const editMode = ref(false);
const summaryContent = ref("");
const editingService = ref(false);
const selectedServiceId = ref("");

const goBack = () => router.push({ name: "incidents" });

const loadIncident = async () => {
  if (!refId.value) return;
  loading.value = true;
  try {
    incident.value = await getIncident(refId.value);
    services.value = incident.value.service ? [incident.value.service] : [];
    selectedServiceId.value = incident.value.serviceId || "";
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load incident";
    error("Failed to load incident", { details: msg });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void loadIncident();
});

watch(
  () => refId.value,
  () => {
    incident.value = null;
    void loadIncident();
  }
);

const severityBadgeClass = (severity: IncidentWithRelations["severity"]) => {
  switch (severity) {
    case "CRITICAL":
      return "badge-error";
    case "HIGH":
      return "badge-warning";
    case "MEDIUM":
      return "badge-info";
    case "LOW":
      return "badge-neutral";
  }
};

const formatSeverity = (severity?: IncidentWithRelations["severity"]) =>
  severity ? severity.toLowerCase() : "";
const formatStatus = (status?: IncidentWithRelations["status"]) =>
  status ? status.toLowerCase() : "";

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "";

const canGenerateSummary = computed(() => incident.value?.status === "RESOLVED");
const latestSummary = computed(() =>
  incident.value?.summaries && incident.value.summaries.length > 0
    ? incident.value.summaries[incident.value.summaries.length - 1]
    : null
);

const handleGenerateSummary = async () => {
  if (!incident.value) return;

  generating.value = true;
  try {
    await generateSummary(incident.value.refId);
    await loadIncident();
    info("AI summary generated successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to generate summary";
    error("Failed to generate summary", { details: errorMsg });
  } finally {
    generating.value = false;
  }
};

const handleEditSummary = () => {
  if (latestSummary.value) {
    summaryContent.value = latestSummary.value.content;
    editMode.value = true;
  }
};

const handleSaveSummary = async () => {
  if (!incident.value || !latestSummary.value) return;

  try {
    await updateSummary(incident.value.refId, latestSummary.value.id, summaryContent.value);
    await loadIncident();
    editMode.value = false;
    info("Summary updated successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update summary";
    error("Failed to update summary", { details: errorMsg });
  }
};

const handleCancelEdit = () => {
  editMode.value = false;
  summaryContent.value = latestSummary.value?.content || "";
};

const handleUpdateService = async () => {
  if (!incident.value) return;

  try {
    await updateIncident(incident.value.refId, {
      serviceId: selectedServiceId.value || undefined
    });
    editingService.value = false;
    await loadIncident();
    info("Service updated successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update service";
    error("Failed to update service", { details: errorMsg });
  }
};

const handleCancelServiceEdit = () => {
  editingService.value = false;
  selectedServiceId.value = incident.value?.serviceId || "";
};

const saveNotes = async () => {
  if (!incident.value) return;

  try {
    await updateIncident(incident.value.refId, {
      internalNotes: incident.value.internalNotes ?? undefined
    });
    await loadIncident();
    info("Notes saved");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save notes";
    error("Failed to save notes", { details: errorMsg });
  }
};

const handleResolve = async () => {
  if (!incident.value) return;

  try {
    await updateIncidentStatus(incident.value.refId, "RESOLVED");
    await loadIncident();
    info("Incident resolved");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to resolve incident";
    error("Failed to resolve incident", { details: errorMsg });
  }
};
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <div>
        <button class="link text-xs mb-1" @click="goBack">
          ← Back to incidents
        </button>
        <h1 class="text-xl font-semibold">
          Incident {{ incident?.refId ?? refId }}
        </h1>
        <p class="text-sm text-base-content/60" v-if="incident">
          {{ incident.title }}
        </p>
        <p class="text-sm text-base-content/60" v-else-if="loading">
          <UiSkeleton variant="text" size="lg" className="w-40 h-4" />
        </p>
      </div>
      <div class="flex gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="incident?.status === 'RESOLVED'"
            @click="handleResolve"
          >
            {{ incident?.status === 'RESOLVED' ? 'Resolved' : 'Resolve' }}
          </UiButton>
          <UiButton variant="danger" size="sm" disabled> Escalate </UiButton>
      </div>
    </div>

    <div v-if="incident" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 space-y-4">
        <UiCard>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold">Timeline</h2>
            <span class="badge badge-ghost badge-sm">
              {{ incident.timeline.length }} events
            </span>
          </div>
          <div v-if="incident.timeline.length === 0" class="text-sm text-base-content/60">
            No timeline events yet.
          </div>
          <ul v-else class="space-y-3">
            <li
              v-for="event in incident.timeline"
              :key="event.id"
              class="rounded-lg border border-base-200 p-3"
            >
              <div class="flex items-center justify-between text-xs text-base-content/70">
                <span class="font-semibold">{{ event.type }}</span>
                <span>{{ formatDate(event.timestamp) }}</span>
              </div>
              <p class="text-sm text-base-content mt-1" v-if="event.message">
                {{ event.message }}
              </p>
            </li>
          </ul>
        </UiCard>

        <UiCard>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold">AI Summary</h2>
              <div class="flex items-center gap-2">
                <!-- Top-right generate button always available when allowed -->
                <UiButton
                  v-if="canGenerateSummary"
                  variant="secondary"
                  size="xs"
                  :loading="generating"
                  @click="handleGenerateSummary"
                  aria-label="Generate summary"
                >
                  {{ generating ? 'Generating...' : 'Generate' }}
                </UiButton>

                <UiButton
                  v-if="!latestSummary && canGenerateSummary"
                  variant="primary"
                  size="sm"
                  :loading="generating"
                  @click="handleGenerateSummary"
                >
                  {{ generating ? 'Generating...' : 'Generate Summary' }}
                </UiButton>

                <template v-else-if="latestSummary && !editMode">
                  <UiButton variant="ghost" size="sm" @click="handleEditSummary">Edit</UiButton>
                </template>

                <template v-else-if="editMode">
                  <UiButton variant="ghost" size="sm" @click="handleCancelEdit">Cancel</UiButton>
                  <UiButton variant="primary" size="sm" @click="handleSaveSummary">Save</UiButton>
                </template>
              </div>
            </div>

          <div v-if="!latestSummary && !canGenerateSummary" class="text-sm text-base-content/70">
            Summaries can be generated once the incident is resolved.
          </div>

          <div v-else-if="!latestSummary && canGenerateSummary" class="text-sm text-base-content/70">
            No summary yet. Click "Generate Summary" to create one using AI.
          </div>

          <div v-else-if="latestSummary">
            <UiTextarea
              v-if="editMode"
              v-model="summaryContent"
              rows="8"
              class="mb-2"
            />
            <div v-else class="prose prose-sm max-w-none mb-2">
              <p class="whitespace-pre-wrap">{{ latestSummary.content }}</p>
            </div>
            <div class="text-xs text-base-content/60">
              Generated {{ formatDate(latestSummary.generatedAt) }}
              via {{ latestSummary.metadata?.provider || 'AI' }}
              <span v-if="latestSummary.metadata?.manuallyEdited" class="badge badge-xs ml-2">Edited</span>
            </div>
          </div>
        </UiCard>
      </div>

      <div class="space-y-4">
        <UiCard>
          <h2 class="text-sm font-semibold mb-2">Properties</h2>
          <dl class="text-xs space-y-2">
            <div class="flex justify-between">
              <dt class="text-base-content/60">Severity</dt>
              <dd class="font-medium">
                <span class="badge badge-sm capitalize" :class="severityBadgeClass(incident.severity)">
                  {{ formatSeverity(incident.severity) }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-base-content/60">Service (optional)</dt>
              <dd class="font-medium" v-if="!editingService">
                {{ incident.service?.name || 'None' }}
                <UiButton variant="ghost" size="xs" @click="editingService = true" class="ml-2">
                  Edit
                </UiButton>
              </dd>
              <dd v-else class="flex items-center gap-2">
                <UiSelect v-model="selectedServiceId" class="text-xs">
                  <option value="">None</option>
                  <option v-for="service in services" :key="service.id" :value="service.id">
                    {{ service.name }}
                  </option>
                </UiSelect>
                <UiButton variant="ghost" size="xs" @click="handleCancelServiceEdit">Cancel</UiButton>
                <UiButton variant="primary" size="xs" @click="handleUpdateService">Save</UiButton>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-base-content/60">Slack channel</dt>
              <dd class="font-medium">
                <a
                  v-if="incident.slackChannelId"
                  :href="`https://slack.com/app_redirect?channel=${incident.slackChannelId.replace('#', '')}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link link-primary"
                >
                  {{ incident.slackChannelName || incident.slackChannelId }}
                </a>
                <span v-else class="text-base-content/70">None</span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-base-content/60">Status</dt>
              <dd class="font-medium capitalize">{{ formatStatus(incident.status) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-base-content/60">Created</dt>
              <dd class="font-medium">{{ formatDate(incident.createdAt) }}</dd>
            </div>
          </dl>
        </UiCard>

        <UiCard>
          <h2 class="text-sm font-semibold mb-2">Notes</h2>
          <UiFormField label="Notes" id="notes">
            <UiTextarea
              id="notes"
              rows="4"
              v-model="incident.internalNotes"
              placeholder="Add notes about this incident (visible to your team)."
            />
          </UiFormField>
          <div class="flex gap-2">
            <UiButton variant="ghost" size="sm" @click="loadIncident">Cancel</UiButton>
            <UiButton variant="primary" size="sm" @click="saveNotes">Save note</UiButton>
          </div>
        </UiCard>
      </div>
    </div>

    <UiCard v-else-if="!loading && !incident">
      <p class="text-sm text-base-content/70">Incident not found.</p>
    </UiCard>
  </section>
</template>
