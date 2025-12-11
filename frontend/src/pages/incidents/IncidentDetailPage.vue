<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiTextarea from "@/components/ui/UiTextarea.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiSkeleton from "@/components/ui/UiSkeleton.vue";
import UiModal from "@/components/ui/UiModal.vue";
import SeveritySelector from "@/components/SeveritySelector.vue";
import ServiceSelector from "@/components/ServiceSelector.vue";
import StatusSelector from "@/components/StatusSelector.vue";
import TimelineItem from "@/components/timeline/TimelineItem.vue";
import { getIncident, IncidentWithRelations, generateSummary, updateSummary, updateIncident, updateIncidentStatus } from "@/api/incidents";
import { getServices, type Service } from "@/api/services";
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
const selectedServiceId = ref<string | null>(null);
const selectedSeverity = ref<IncidentWithRelations["severity"]>("MEDIUM");

// Confirmation modal state
const showConfirmModal = ref(false);
const pendingChange = ref<{
  type: 'status' | 'severity' | 'service';
  value: any;
  label: string;
} | null>(null);
const checkingSlack = ref(false);
const slackCheckAttempts = ref(0);
let slackIntervalId: number | null = null;

const stopSlackPolling = () => {
  if (slackIntervalId !== null) {
    clearInterval(slackIntervalId);
    slackIntervalId = null;
  }
  checkingSlack.value = false;
  slackCheckAttempts.value = 0;
};

const startSlackPolling = async () => {
  stopSlackPolling();
  slackCheckAttempts.value = 0;
  checkingSlack.value = true;
  // poll every second up to 5 attempts
  slackIntervalId = window.setInterval(async () => {
    if (!refId.value) return;
    try {
      const updated = await getIncident(refId.value);
      incident.value = updated;
      if (incident.value?.slackChannelId) {
        stopSlackPolling();
        return;
      }
    } catch (err) {
      // ignore transient errors while polling
    }

    slackCheckAttempts.value += 1;
    if (slackCheckAttempts.value >= 5) {
      stopSlackPolling();
    }
  }, 1000);
};

const goBack = () => router.push({ name: "incidents" });

const loadIncident = async () => {
  if (!refId.value) return;
  loading.value = true;
  try {
    incident.value = await getIncident(refId.value);
    selectedServiceId.value = incident.value.serviceId || null;
    selectedSeverity.value = incident.value.severity;
    // If Slack channel isn't present yet, poll briefly to see if the worker creates it
    if (!incident.value?.slackChannelId) {
      void startSlackPolling();
    } else {
      stopSlackPolling();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load incident";
    error("Failed to load incident", { details: msg });
  } finally {
    loading.value = false;
  }
};

const loadServices = async () => {
  try {
    services.value = await getServices();
  } catch (err) {
    // silently fail - services are optional
    console.error("Failed to load services", err);
  }
};

onMounted(() => {
  void loadIncident();
  void loadServices();
});

onBeforeUnmount(() => {
  stopSlackPolling();
});

watch(
  () => refId.value,
  () => {
    incident.value = null;
    void loadIncident();
  }
);

const formatStatus = (status?: IncidentWithRelations["status"]) =>
  status ? status.toLowerCase() : "";

// Timeline rendering is delegated to `TimelineItem` component

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "";

const latestSummary = computed(() =>
  incident.value?.summaries && incident.value.summaries.length > 0
    ? incident.value.summaries[incident.value.summaries.length - 1]
    : null
);

const showRegenerateSummaryModal = ref(false);

const handleGenerateSummary = async () => {
  if (!incident.value) return;

  // If summary already exists, show confirmation modal
  if (latestSummary.value) {
    showRegenerateSummaryModal.value = true;
    return;
  }

  // Otherwise generate directly
  await performGenerateSummary();
};

const confirmRegenerateSummary = async () => {
  showRegenerateSummaryModal.value = false;
  await performGenerateSummary();
};

const cancelRegenerateSummary = () => {
  showRegenerateSummaryModal.value = false;
};

const performGenerateSummary = async () => {
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

const handleUpdateService = async (serviceId: string | null) => {
  if (!incident.value) return;

  const serviceName = serviceId
    ? services.value.find(s => s.id === serviceId)?.name || 'Unknown Service'
    : 'None';

  pendingChange.value = {
    type: 'service',
    value: serviceId,
    label: serviceName
  };
  showConfirmModal.value = true;
};

const handleUpdateSeverity = async (severity: IncidentWithRelations["severity"]) => {
  if (!incident.value) return;

  pendingChange.value = {
    type: 'severity',
    value: severity,
    label: severity.charAt(0) + severity.slice(1).toLowerCase()
  };
  showConfirmModal.value = true;
};

const handleUpdateStatus = async (status: IncidentWithRelations["status"]) => {
  if (!incident.value) return;

  pendingChange.value = {
    type: 'status',
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase()
  };
  showConfirmModal.value = true;
};

const confirmChange = async () => {
  if (!incident.value || !pendingChange.value) return;

  try {
    const { type, value } = pendingChange.value;

    if (type === 'service') {
      await updateIncident(incident.value.refId, {
        serviceId: value === null ? null : value
      });
      info("Service updated successfully");
    } else if (type === 'severity') {
      await updateIncident(incident.value.refId, {
        severity: value
      });
      info("Severity updated successfully");
    } else if (type === 'status') {
      await updateIncidentStatus(incident.value.refId, value);
      info("Status updated successfully");
    }

    await loadIncident();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `Failed to update ${pendingChange.value.type}`;
    error(`Failed to update ${pendingChange.value.type}`, { details: errorMsg });
  } finally {
    showConfirmModal.value = false;
    pendingChange.value = null;
  }
};

const cancelChange = () => {
  showConfirmModal.value = false;
  pendingChange.value = null;
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
            <li v-for="event in incident.timeline" :key="event.id">
              <TimelineItem :event="event" />
            </li>
          </ul>
        </UiCard>

        <UiCard>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold">AI Summary</h2>
            <div class="flex items-center gap-2">
              <UiButton
                variant="secondary"
                size="xs"
                :loading="generating"
                @click="handleGenerateSummary"
                aria-label="Generate summary"
              >
                {{ generating ? 'Generating...' : (latestSummary ? 'Regenerate' : 'Generate') }}
              </UiButton>

              <template v-if="latestSummary && !editMode">
                <UiButton variant="ghost" size="sm" @click="handleEditSummary">Edit</UiButton>
              </template>

              <template v-else-if="editMode">
                <UiButton variant="ghost" size="sm" @click="handleCancelEdit">Cancel</UiButton>
                <UiButton variant="primary" size="sm" @click="handleSaveSummary">Save</UiButton>
              </template>
            </div>
          </div>

          <div v-if="!latestSummary" class="text-sm text-base-content/70">
            No summary yet. Click "Generate" to create one using AI.
          </div>

          <div v-else>
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
            <div class="flex justify-between items-start gap-3">
              <dt class="text-base-content/60 pt-1">Status</dt>
              <dd class="text-right flex-1 min-w-0">
                <StatusSelector
                  :model-value="incident.status"
                  @update:model-value="handleUpdateStatus"
                />
              </dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-base-content/60 pt-1">Severity</dt>
              <dd class="text-right flex-1 min-w-0">
                <SeveritySelector
                  :model-value="incident.severity"
                  @update:model-value="handleUpdateSeverity"
                />
              </dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-base-content/60 pt-1">Linked service</dt>
              <dd class="text-right flex-1 min-w-0">
                <ServiceSelector
                  :model-value="incident.serviceId"
                  :services="services"
                  @update:model-value="handleUpdateService"
                />
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
                <span v-else-if="checkingSlack" class="text-base-content/70 flex items-center">
                  <span class="loading loading-spinner loading-sm mr-2" aria-hidden="true"></span>
                  Checking…
                </span>
                <span v-else class="text-base-content/70">None</span>
              </dd>
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

    <!-- Confirmation Modal -->
    <UiModal v-model="showConfirmModal" :title="`Change ${pendingChange?.type || ''}`">
      <p v-if="pendingChange">
        Change <strong>{{ pendingChange.type }}</strong> to
        <strong>{{ pendingChange.label }}</strong>?
      </p>
      <template #actions>
        <UiButton variant="ghost" @click="cancelChange">Cancel</UiButton>
        <UiButton variant="primary" @click="confirmChange">Confirm</UiButton>
      </template>
    </UiModal>

    <!-- Regenerate Summary Confirmation Modal -->
    <UiModal v-model="showRegenerateSummaryModal" title="Regenerate AI Summary">
      <p>
        An AI summary already exists for this incident.
        Generating a new summary will replace the existing one.
      </p>
      <p class="mt-2 text-sm text-base-content/70">
        Do you want to continue?
      </p>
      <template #actions>
        <UiButton variant="ghost" @click="cancelRegenerateSummary">Cancel</UiButton>
        <UiButton variant="primary" @click="confirmRegenerateSummary">Regenerate</UiButton>
      </template>
    </UiModal>
  </section>
</template>
