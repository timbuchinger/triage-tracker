<script setup lang="ts">
import { computed, reactive, toRefs, watch } from "vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{
  modelValue?: {
    statuses?: string[];
    dateRange?: "7" | "30" | "90" | "all";
    owner?: "me" | "everyone";
  };
}>();

const emit = defineEmits<{
  "update:modelValue": [(v: any) => void];
}>();

const STATUS_OPTIONS = ["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"];

const internal = reactive({
  statuses: props.modelValue?.statuses ? [...props.modelValue.statuses] : [...STATUS_OPTIONS],
  dateRange: props.modelValue?.dateRange ?? "30",
  owner: props.modelValue?.owner ?? "everyone"
});

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    internal.statuses = v.statuses ? [...v.statuses] : [...STATUS_OPTIONS];
    internal.dateRange = v.dateRange ?? "30";
    internal.owner = v.owner ?? "everyone";
  }
);

watch(
  internal,
  () => {
    const payload: any = {
      statuses: internal.statuses && internal.statuses.length ? [...internal.statuses] : undefined,
      dateRange: internal.dateRange,
      owner: internal.owner
    };

    // Only emit when the payload actually differs from the incoming prop
    // to avoid feedback loops where prop updates cause the child to
    // re-emit the same values back to the parent.
    const current = props.modelValue ?? {};
    const normalize = (p: any) => ({
      statuses: p.statuses ?? undefined,
      dateRange: p.dateRange ?? undefined,
      owner: p.owner ?? undefined
    });

    if (JSON.stringify(normalize(payload)) !== JSON.stringify(normalize(current))) {
      emit("update:modelValue", payload);
    }
  },
  { deep: true }
);



const toggleStatus = (s: string) => {
  const idx = internal.statuses.indexOf(s);
  if (idx >= 0) internal.statuses.splice(idx, 1);
  else internal.statuses.push(s);
};

const resetDefaults = () => {
  internal.statuses = [...STATUS_OPTIONS];
  internal.dateRange = "30";
  internal.owner = "everyone";
};
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 mb-3">
    <div class="flex items-center gap-4">
      <UiFormField label="Status">
        <div class="flex gap-2">
          <label v-for="s in STATUS_OPTIONS" :key="s" class="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" class="checkbox" :checked="internal.statuses.includes(s)" @change="() => toggleStatus(s)" />
            <span class="capitalize">{{ s.toLowerCase() }}</span>
          </label>
        </div>
      </UiFormField>

      <UiFormField label="Date">
        <UiSelect v-model="internal.dateRange">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </UiSelect>
      </UiFormField>

      <UiFormField label="Owner">
        <div class="btn-group">
          <UiButton :variant="internal.owner === 'everyone' ? 'secondary' : 'ghost'" :active="internal.owner === 'everyone'" size="sm" @click="() => (internal.owner = 'everyone')">Everyone</UiButton>
          <UiButton :variant="internal.owner === 'me' ? 'secondary' : 'ghost'" :active="internal.owner === 'me'" size="sm" @click="() => (internal.owner = 'me')">Me</UiButton>
        </div>
      </UiFormField>
    </div>

    <div class="ml-auto">
      <UiButton variant="ghost" size="sm" @click="resetDefaults">Reset</UiButton>
    </div>
  </div>
</template>
