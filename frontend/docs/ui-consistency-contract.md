# Triage Tracker – UI Consistency Contract

You are working on the Triage Tracker web app.

The front-end uses **Vue 3**, **Tailwind CSS v4**, and **DaisyUI v5** with the `nord` and `nord-dark` themes. The design must always look like a modern, professional incident management app.

## Absolute Rules

1. **Do NOT invent new CSS styles ad hoc.**
   - Do NOT add raw `style=""` attributes for spacing, borders, fonts, or colors.
   - Do NOT use arbitrary Tailwind values like `p-[14px]`, `rounded-[6px]`, or `max-w-[60%]`.
   - All values must come from the Tailwind scale defined in `tailwind.config.ts`.

2. **Use the shared UI components from `src/components/ui/`**
   - Buttons: `UiButton`
   - Cards/containers: `UiCard`
   - Text inputs: `UiInput`
   - Text areas: `UiTextarea`
   - Selects: `UiSelect`
   - Form layout (label + field + hint/error): `UiFormField`
   - Modals: `UiModal` (for all confirmation dialogs, not browser-native `confirm()` or `alert()`)
   - If you need a new primitive, create/update it in `src/components/ui/` and reuse it.

3. **Spacing and layout**
   - Use Tailwind spacing scale defined in `tailwind.config.ts` (`1,2,3,4,6,8,10`).
   - Typical vertical gaps between fields: `gap-3` or `space-y-3`.
   - Typical card padding: `p-4`.
   - Do NOT introduce new spacing values outside the defined scale.

4. **Border radius**
   - Use `rounded-md`, `rounded-lg`, or `rounded-full` only.
   - Buttons and inputs must always use `rounded-md`.
   - Cards use `rounded-lg`.
   - Do NOT use arbitrary radius classes.

5. **Typography**
   - Use Tailwind/Daisy classes only: `text-xs`, `text-sm`, `text-base`, etc.
   - Labels must use the style defined in `UiFormField` (do not override).
   - Page titles: `text-xl font-semibold`.
   - Section headings: `text-sm font-medium text-base-content/80`.

6. **Colors and themes**
   - Use DaisyUI semantic classes: `btn-primary`, `btn-secondary`, `btn-ghost`, `bg-base-100`, `text-base-content`, `alert-info`, etc.
   - Do NOT hard-code hex colors in components. Always use the theme tokens.

7. **Forms**
   - Every field must be wrapped in `UiFormField`.
   - Errors and hints must go through `UiFormField`’s `error` and `hint` props.
   - Keep consistent vertical rhythm using `gap-3` or `space-y-3`.


8. **Badges and status indicators**
   - Use DaisyUI badge classes: `badge`, `badge-primary`, `badge-secondary`, etc.
   - For selectable badges (like role dropdowns), use or create a custom component in `src/components/` that maintains the badge styling while providing interaction.
   - Do NOT mix styled badges with unstyled form controls for the same data type. Visual consistency is critical.
   - Example: If user roles are displayed as colored badges, role selection should also use badge-styled options, not plain text dropdowns.
9. **Dark mode**
   - Do not special-case dark mode in components.
   - Rely on DaisyUI `nord` / `nord-dark` theme tokens. Theme switching is handled at the document root.

## Before You Finish Any UI Work

Before finalizing a PR or code change that affects UI, review:

- Are ALL buttons using `UiButton` with `variant` and `size` props?
- Are ALL form fields wrapped in `UiFormField`?
- Are ALL spacing and radius values from the Tailwind scale and not arbitrary?
- Are ALL colors semantic (DaisyUI/tailwind classes) rather than hex values?
- Did you avoid inline styles for layout, spacing, radius, and colors?
- Did you check `ui-patterns.md` for established patterns before creating new interaction designs?

## Loading indicators (recommended patterns)

- **Use shared primitives:** Prefer `UiButton`'s `loading` prop for button-level actions, `UiAppLoader` for full-app bootstrapping, and `UiSkeleton` (add new) for content-shaped placeholders.
- **When to use what:**
   - **Quick actions (<1s):** show a button-level spinner using `UiButton loading`.
   - **Moderate waits (1–3s):** show inline spinners near the content or use subtle skeletons for blocks.
   - **Longer loads (>3s):** use skeletons (content-shaped) for main panels or a focused loader — avoid blocking the entire app unless necessary.
- **Accessibility:** Loading primitives should set `role="status"` and include an accessible label (screen-reader text). `UiAppLoader` should include visible text like "Loading…".
- **Styling:** Use DaisyUI/Tailwind utility classes (`loading`, `loading-spinner`, `skeleton`, `skeleton-text`) and Tailwind spacing tokens. Do NOT add inline CSS for sizes or animations.
- **Create primitives in `src/components/ui/`:** If you need a new loader type (e.g., `UiSkeleton`, `UiInlineLoader`), implement it under `src/components/ui/` and reuse it across pages.

### Guidance & Examples

Follow these concrete patterns to ensure consistent loading UX across the app.

- **Button-level (short actions, confirmations)**

   Use the `UiButton` `loading` prop instead of sprinkling inline spans and `disabled` attributes in pages. `UiButton` already renders a small spinner and disables interaction.

   Example:

   ```vue
   <UiButton :loading="saving" variant="primary" @click="save">Save</UiButton>
   ```

   - `loading` should be a boolean from the action's state (e.g., `saving`, `submitting`).
   - Prefer `UiButton`'s prop so styles and a11y are centralized.

- **Inline / small content spinners (moderate waits)**

   For small inline waits (e.g., fetching one panel), prefer a small shared primitive such as `UiInlineLoader` or a `UiSkeleton` with a compact size. Avoid blocking the entire page.

   Example (small spinner):

   ```vue
   <span class="loading loading-spinner loading-xs" aria-hidden="true" />
   <span class="sr-only">Loading</span>
   ```

- **Skeletons (content-shaped placeholders)**

   For longer loads that replace entire panels or lists, use skeletons shaped like the content. This reduces perceived latency and avoids layout shift.

   Example (new shared component `UiSkeleton`):

   ```vue
   <!-- header placeholder -->
   <UiSkeleton variant="text" className="w-40 h-4" />

   <!-- multi-line paragraph placeholder -->
   <div class="space-y-2">
      <UiSkeleton variant="text" className="w-full h-3" />
      <UiSkeleton variant="text" className="w-5/6 h-3" />
   </div>
   ```

- **Full app or route bootstrapping**

   For app-level bootstrapping (initial load, auth checks), use `UiAppLoader` which centers a large spinner and readable text.

   ```vue
   <UiAppLoader />
   ```

### Accessibility checklist

- Every loading primitive should expose an accessible status:
   - Use `role="status"` on the loader container when appropriate.
   - Include either visible text (e.g., `Loading…`) or a screen-reader-only label (`<span class="sr-only">Loading data</span>`).
   - For dynamic regions where content will change, consider `aria-live="polite"` on the content container when announcing completion makes sense.

### Styling rules

- Use DaisyUI/Tailwind utilities only: `loading`, `loading-spinner`, `skeleton`, `skeleton-text`, and Tailwind spacing classes from the agreed scale. Do NOT add inline CSS or custom animations.
- Ensure `rounded-md`, `rounded-lg` values follow the component role rules.

### Testing

- Unit-test loading states of all shared primitives (e.g., `UiButton`, `UiSkeleton`) and add simple assertions to page tests to confirm skeletons or spinners show during loading.
- Avoid brittle snapshot tests for animated or timing-sensitive loaders.

### When in doubt

- If you need a new loader pattern, implement it under `src/components/ui/` and add a unit test + documentation snippet. Then update this doc so other agents/devs follow the pattern.

If any of the above is not true, **refactor the code to comply with this contract**.
