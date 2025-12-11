<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import UiCard from "@/components/ui/UiCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import IncidentsFilterBar from "@/components/IncidentsFilterBar.vue";
import { Incident, listIncidents } from "@/api/incidents";
import { useNotifications } from "@/composables/useNotifications";
import { updateIncident } from "@/api/incidents";

const router = useRouter();
const { error, info } = useNotifications();

const incidents = ref<Incident[]>([]);
const loading = ref(false);
const filters = ref<{ statuses?: string[]; dateRange?: string; owner?: string }>({ statuses: ["OPEN"], dateRange: "30", owner: "everyone" });

const goToNew = () => router.push({ name: "incident-create" });
const goToDetail = (refId: string) =>
  router.push({ name: "incident-detail", params: { id: refId } });

const fetchIncidents = async () => {
  loading.value = true;
  try {
    incidents.value = await listIncidents({ statuses: filters.value.statuses as any, dateRange: filters.value.dateRange as any, owner: filters.value.owner as any });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to load incidents";
    error("Failed to load incidents", { details: errorMessage });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // read query params
  const q = router.currentRoute.value.query;
  if (q.status) {
    filters.value.statuses = Array.isArray(q.status) ? (q.status as string[]) : [q.status as string];
  }
  if (q.dateRange) filters.value.dateRange = q.dateRange as string;
  if (q.owner) filters.value.owner = q.owner as string;

  void fetchIncidents();
});

watch(filters, (v) => {
  const query: Record<string, any> = {};
  if (v.statuses && v.statuses.length) query.status = v.statuses;
  if (v.dateRange) query.dateRange = v.dateRange;
  if (v.owner) query.owner = v.owner;

  // Normalize current route query for a fair comparison so we don't
  // trigger a router replace (and thus a route watcher update) when
  // the values are already the same. This prevents a recursive
  // update loop between `filters` and the route query.
  const currentQ = router.currentRoute.value.query;
  const currentNormalized: Record<string, any> = {};
  if (currentQ.status) currentNormalized.status = Array.isArray(currentQ.status) ? (currentQ.status as string[]) : [currentQ.status as string];
  if (currentQ.dateRange) currentNormalized.dateRange = currentQ.dateRange as string;
  if (currentQ.owner) currentNormalized.owner = currentQ.owner as string;

  const queriesEqual = JSON.stringify(query) === JSON.stringify(currentNormalized);
  if (!queriesEqual) {
    void router.replace({ name: router.currentRoute.value.name as any, query });
  }

  void fetchIncidents();
}, { deep: true });

// Keep filters in sync when the route query changes elsewhere in the app
watch(
  () => router.currentRoute.value.query,
  (q) => {
    // Avoid unnecessary updates by checking differences before assigning
    const newStatuses = q.status
      ? (Array.isArray(q.status) ? (q.status as string[]) : [q.status as string])
      : [];

    const newDateRange = q.dateRange ? (q.dateRange as string) : undefined;
    const newOwner = q.owner ? (q.owner as string) : undefined;

    // Update only if there's a real change
    const statusesChanged = JSON.stringify(newStatuses) !== JSON.stringify(filters.value.statuses ?? []);
    const dateRangeChanged = newDateRange !== filters.value.dateRange;
    const ownerChanged = newOwner !== filters.value.owner;

    if (statusesChanged) filters.value.statuses = newStatuses.length ? newStatuses : undefined;
    if (dateRangeChanged && newDateRange !== undefined) filters.value.dateRange = newDateRange;
    if (ownerChanged && newOwner !== undefined) filters.value.owner = newOwner;
  }
);

const severityBadgeClass = (severity: Incident["severity"]) => {
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

const severityOptions: { label: string; value: Incident["severity"] }[] = [
  { label: "Critical", value: "CRITICAL" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" }
];

const onChangeSeverity = async (incident: Incident, newSeverity: Incident["severity"]) => {
  const old = incident.severity;
  // optimistic update
  incident.severity = newSeverity;
  try {
    await updateIncident(incident.refId, { severity: newSeverity });
    info("Severity updated");
  } catch (err) {
    incident.severity = old;
    const errorMessage = err instanceof Error ? err.message : "Failed to update severity";
    error("Failed to update severity", { details: errorMessage });
  }
};

const formatSeverity = (severity: Incident["severity"]) => severity.toLowerCase();
const formatStatus = (status: Incident["status"]) => status.toLowerCase();

const formatDate = (isoString: string) =>
  new Date(isoString).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  });
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Incidents</h1>
        <p class="text-sm text-base-content/60">
          Monitor and manage active incidents across your stack.
        </p>
      </div>
      <UiButton variant="primary" size="md" class="gap-2" @click="goToNew">
        <span aria-hidden="true" class="text-lg leading-none">+</span>
        <span>Create incident</span>
      </UiButton>
    </div>

    <IncidentsFilterBar v-model="filters" />

    <UiCard>
      <div v-if="loading" class="p-4 text-sm text-base-content/70">
        Loading incidents…
      </div>
      <div v-else-if="incidents.length" class="overflow-x-auto">
        <table class="table w-full text-sm">
          <thead class="border-b border-base-200/80">
            <tr>
              <th class="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">ID</th>
              <th class="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Title
              </th>
              <th class="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Severity
              </th>
              <th class="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Status
              </th>
              <th class="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Owner
              </th>
              <th class="py-2 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-200/70">
            <tr
              v-for="incident in incidents"
              :key="incident.refId"
              class="cursor-pointer transition-colors hover:bg-base-200/40"
              @click="goToDetail(incident.refId)"
            >
              <td class="py-3 pr-4 text-left text-sm font-semibold text-base-content whitespace-nowrap">
                {{ incident.refId }}
              </td>
              <td class="py-3 pr-4 text-left text-sm font-medium text-base-content">
                {{ incident.title }}
              </td>
              <td class="py-3 pr-4 text-left">
                <div class="w-36">
                  <UiSelect
                    :modelValue="incident.severity"
                    @update:modelValue="(v) => onChangeSeverity(incident, v)"
                    @click.stop
                  >
                    <option disabled value="">Select severity</option>
                    <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </UiSelect>
                </div>
              </td>
              <td class="py-3 pr-4 text-left text-sm capitalize text-base-content/80">
                {{ formatStatus(incident.status) }}
              </td>
              <td class="py-3 text-left text-sm text-base-content/70 whitespace-nowrap">
                {{ incident.owner?.name ?? incident.owner?.email ?? '—' }}
              </td>
              <td class="py-3 text-left text-sm text-base-content/70 whitespace-nowrap">
                {{ formatDate(incident.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="p-4 text-sm text-base-content/70">
        No incidents yet.
      </div>
    </UiCard>
  </section>
</template>
