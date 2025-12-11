# Coding Agent Instructions – Triage Tracker UI

When generating or modifying UI code for Triage Tracker:

- Use **Vue 3 + Tailwind v4 + DaisyUI v5** conventions.
- Assume themes `nord` and `nord-dark` are configured in `tailwind.config.ts`.

## Always use these components

- Use `<UiButton>` for all buttons.
- Use `<UiCard>` for cards, panels, and containers.
- Use `<UiInput>`, `<UiTextarea>`, and `<UiSelect>` for fields.
- Wrap all fields in `<UiFormField>` for label/hint/error consistency.

Import from:

```ts
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiTextarea from "@/components/ui/UiTextarea.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiSkeleton from "@/components/ui/UiSkeleton.vue";
```

## Tailwind and DaisyUI rules

- Use Tailwind spacing classes from the configured scale: `gap-3`, `p-4`, `space-y-3`, etc.
- Use radius classes: `rounded-md` (buttons/inputs), `rounded-lg` (cards).
- Use DaisyUI semantic classes: `btn-primary`, `bg-base-100`, `text-base-content`, etc.
- Do **not** use arbitrary values like `p-[14px]`, `rounded-[10px]`, or hex colors.

### Badges and status indicators

- Use DaisyUI badge classes: `badge`, `badge-primary`, `badge-secondary`, etc.
- When users can select or change a badge value (like roles or statuses), create a custom component that maintains badge styling in both the display and selection states.
- Do NOT use plain `<select>` dropdowns alongside styled badges for the same data type.
- Example: See `RoleSelector.vue` for a pattern that displays roles as badges while allowing selection.

If you need a new UI primitive or layout pattern, create it in `src/components/ui/` and reuse it consistently instead of inlining styles.

## UI Patterns

For common interaction patterns (inline editing, property lists, related data loading), consult `frontend/docs/ui-patterns.md` before implementing. Follow established patterns to maintain consistency.

### Loading primitives

- Add new loading primitives to `src/components/ui/` (for example `UiSkeleton`, `UiInlineLoader`) and unit-test them.
- Example usages:

```vue
<template>
	<UiButton :loading="saving">Save</UiButton>
	<UiSkeleton variant="text" className="w-40 h-4" />
	<UiAppLoader />
</template>
```
