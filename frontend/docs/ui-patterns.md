# UI Patterns & Best Practices

This document defines reusable UI patterns for common interactions in Triage Tracker. Follow these patterns to maintain consistency across the application.

## Inline Editing in Property Lists

When displaying read-only properties with optional inline editing (e.g., in sidebar cards or detail panels):

### Pattern: Two-state toggle (view/edit)

**Use case:** Optional fields that can be edited in-place without a full form page.

**Structure:**
```vue
<dl class="text-xs space-y-2">
  <div class="flex justify-between items-start gap-3">
    <dt class="text-base-content/60 pt-1">Property name</dt>
    <dd class="text-right flex-1 min-w-0">
      <!-- View mode -->
      <div v-if="!editing">
        <div class="font-medium text-sm mb-1" v-if="hasValue">
          {{ displayValue }}
        </div>
        <div class="text-xs text-base-content/60 mb-1" v-else>
          Not set
        </div>
        <UiButton variant="ghost" size="xs" @click="editing = true">
          {{ hasValue ? 'Change' : 'Set value' }}
        </UiButton>
      </div>
      
      <!-- Edit mode -->
      <div v-else class="space-y-2">
        <UiSelect v-model="selectedValue" class="w-full text-xs">
          <option value="">None</option>
          <option v-for="opt in options" :key="opt.id" :value="opt.id">
            {{ opt.name }}
          </option>
        </UiSelect>
        <div class="flex gap-1 justify-end">
          <UiButton variant="ghost" size="xs" @click="handleCancel">Cancel</UiButton>
          <UiButton variant="primary" size="xs" @click="handleSave">Save</UiButton>
        </div>
      </div>
    </dd>
  </div>
</dl>
```

### Key principles:

1. **Use `items-start` for multi-line content** - Ensures labels align to the top when values wrap
2. **Add `gap-3` between dt/dd** - Provides breathing room
3. **Use `flex-1 min-w-0` on dd** - Allows flexible wrapping without breaking layout
4. **Vertical stacking in edit mode** - Use `space-y-2` for field + buttons
5. **Contextual button text** - "Change" vs "Set value" / "Link" based on state
6. **Show empty state** - Display "Not set" / "Not linked" / "None" when value is missing
7. **Right-align the value section** - Use `text-right` for cleaner visual hierarchy

### When NOT to use this pattern:

- **Required fields** - Use a dedicated form page or always-visible form
- **Complex validation** - If editing requires multiple dependent fields
- **Frequent edits** - If users edit this field often, show it as editable by default
- **Mobile-first views** - Consider a separate edit page for better mobile UX

### Example implementations:

- **Incident detail page** - Service linking (optional relation)
- **User profile** - Team assignment (optional relation)
- **Settings** - Optional configuration values

## Definition Lists (dl/dt/dd)

Use semantic HTML for property/value pairs in cards:

```vue
<dl class="text-xs space-y-2">
  <div class="flex justify-between">
    <dt class="text-base-content/60">Label</dt>
    <dd class="font-medium">Value</dd>
  </div>
</dl>
```

- Use `text-xs` for compact property displays
- Use `text-base-content/60` for labels (muted)
- Use `font-medium` for values (emphasized)
- Use `space-y-2` between property pairs

## Related Data Loading

When displaying related data (services, teams, users):

1. **Load independently** - Don't rely on relations included in parent data
2. **Cache in component state** - Store in `ref<T[]>()` at component level
3. **Load on mount** - Fetch in `onMounted()` hook
4. **Fail gracefully** - If optional, log errors and continue with empty array
5. **Show all options** - Always fetch complete lists for selects/autocomplete

Example:
```typescript
const services = ref<Service[]>([]);

const loadServices = async () => {
  try {
    services.value = await getServices();
  } catch (err) {
    console.error("Failed to load services", err);
  }
};

onMounted(() => {
  void loadServices();
});
```

## Computed Display Values

For derived UI values, use computed properties:

```typescript
const currentServiceName = computed(() => {
  if (!incident.value?.serviceId) return null;
  const service = services.value.find(s => s.id === incident.value?.serviceId);
  return service?.name || incident.value.service?.name || "Unknown";
});
```

This pattern:
- Separates presentation logic from template
- Handles multiple fallback scenarios
- Returns null for proper conditional rendering

## Buttons in Compact Layouts

For inline actions in property lists:
- Use `variant="ghost"` for subtle actions
- Use `size="xs"` for compact spaces
- Place edit/change buttons directly below values
- Use `gap-1` for save/cancel button pairs
- Align action buttons with `justify-end`
