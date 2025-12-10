<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import UiButton from "@/components/ui/UiButton.vue";

type Theme = "nord" | "nord-dark";

const router = useRouter();
const authStore = useAuthStore();

const THEME_STORAGE_KEY = "triage-theme";
const theme = ref<Theme>("nord");
const themeOptions: { label: string; value: Theme }[] = [
  { label: "Light", value: "nord" },
  { label: "Dark", value: "nord-dark" }
];

const themeTargets = () => [document.documentElement, document.body, document.getElementById("app")].filter(Boolean) as Element[];

const setThemeAttribute = (value: Theme) => {
  themeTargets().forEach((el) => el.setAttribute("data-theme", value));
};

const applyTheme = (value: Theme) => {
  setThemeAttribute(value);
  theme.value = value;
  window.localStorage.setItem(THEME_STORAGE_KEY, value);
};

const resolveInitialTheme = (): Theme => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "nord" || stored === "nord-dark") {
    return stored;
  }
  const attrs = themeTargets()
    .map((el) => el.getAttribute("data-theme") as Theme | null)
    .find((value): value is Theme => value === "nord" || value === "nord-dark");
  return attrs ?? "nord";
};

onMounted(() => {
  applyTheme(resolveInitialTheme());
});
</script>

<template>
  <header class="w-full bg-base-100 border-b border-base-300">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <img src="/icon.png" class="w-8 h-8 rounded-lg" alt="Triage Tracker" />
        <div class="flex flex-col">
          <span class="text-sm font-semibold">Triage Tracker</span>
          <span class="text-xs text-base-content/60">Real-time incident response</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
          <span class="text-base-content/70">{{ authStore.user?.email }}</span>
          <span v-if="authStore.isOwner" class="badge badge-sm badge-primary">Owner</span>
        </div>

        <span class="text-base-content/60">Theme</span>
        <div class="join inline-flex items-center border border-base-300 rounded-md bg-base-100 shadow-sm">
          <UiButton
            v-for="option in themeOptions"
            :key="option.value"
            :variant="theme === option.value ? 'base' : 'ghost'"
            size="sm"
            type="button"
            class="join-item theme-toggle__button rounded-none px-4 text-xs transition-colors"
            :class="[
              theme === option.value
                ? 'theme-toggle__button--active btn-active font-semibold'
                : 'text-base-content/60 hover:text-base-content'
            ]"
            :aria-pressed="theme === option.value"
            @click="applyTheme(option.value)"
          >
            {{ option.label }}
          </UiButton>
        </div>

        <UiButton
          v-if="authStore.isAuthenticated"
          variant="ghost"
          size="sm"
          @click="async () => { await authStore.logout(); router.push({ name: 'login' }); }"
        >
          Sign out
        </UiButton>
      </div>
    </div>
  </header>
</template>
