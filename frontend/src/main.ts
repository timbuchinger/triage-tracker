import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";
import UiAppLoader from "@/components/ui/UiAppLoader.vue";
import App from "./App.vue";
import "./style.css";
import { routes } from "./router";
import { useAuthStore } from "./stores/auth";
import { useNotificationStore } from "./stores/notifications";

// Ensure the user's stored theme is applied as early as possible so
// initial route renders (including the 404 page) match the chosen theme.
const THEME_STORAGE_KEY = "triage-theme";
const applyInitialTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ("nord" | "nord-dark") | null;
    const targets = [document.documentElement, document.body, document.getElementById("app")].filter(Boolean) as Element[];
    if (stored === "nord" || stored === "nord-dark") {
      targets.forEach((el) => el.setAttribute("data-theme", stored));
      return;
    }

    // If nothing is stored, preserve any existing data-theme already present on an element.
    const existing = targets.map((el) => el.getAttribute("data-theme")).find(Boolean);
    if (existing) {
      targets.forEach((el) => {
        if (!el.getAttribute("data-theme")) el.setAttribute("data-theme", existing as string);
      });
    }
  } catch (e) {
    // ignore - non-fatal
  }
};

applyInitialTheme();

const router = createRouter({
  history: createWebHistory(),
  routes
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);

// Mount a lightweight loader while we validate auth on startup
const loaderRoot = document.createElement("div");
loaderRoot.id = "app-loader";
document.body.appendChild(loaderRoot);
const loaderApp = createApp(UiAppLoader);
loaderApp.mount(loaderRoot);

// Global fetch wrapper: redirect to login when API returns 401 (expired session)
// This covers both direct `fetch` calls and our `request` helper.
const _originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const resp = await _originalFetch(...args);

  if (resp.status === 401) {
    // Build the current location to return to after login
    const current = window.location.pathname + window.location.search + window.location.hash;
    const loginUrl = `/login?redirect=${encodeURIComponent(current)}`;

    // If we're not already on the login page, navigate there.
    if (!window.location.pathname.startsWith("/login")) {
      // Use full navigation to ensure state is cleared and route guard runs
      window.location.href = loginUrl;
    }
  }

  return resp;
};

// Load auth from storage and validate token if present to avoid redirect loops
const authStore = useAuthStore();
authStore.loadFromStorage();

// If there's a stored token, try to refresh it before allowing navigation.
// This prevents a stale token from making the app think the user is authenticated
// while the backend rejects requests (which would otherwise cause a redirect loop).
const initializeAuthAndMount = async () => {
  if (authStore.accessToken) {
    try {
      // Attempt to refresh; on failure, refresh() logs out which clears stored auth
      await authStore.refresh();
    } catch (err) {
      // ignore - refresh already handles logout
    }
  }

  // Router guard for authentication (can run after refresh)
  router.beforeEach((to, from, next) => {
    const isPublic = to.meta.public === true;
    const isAuthenticated = authStore.isAuthenticated;

    if (!isPublic && !isAuthenticated) {
      next({ name: "login", query: { redirect: to.fullPath } });
    } else if (to.name === "login" && isAuthenticated) {
      next({ name: "incidents" });
    } else {
      next();
    }
  });

  // Clear error notifications when navigating to a new page so that
  // stale error alerts don't persist across views.
  router.afterEach(() => {
    const notifStore = useNotificationStore();
    notifStore.clearErrors();
  });

  app.mount("#app");
  // Once the main app is mounted, remove the temporary loader
  try {
    loaderApp.unmount();
    document.body.removeChild(loaderRoot);
  } catch (e) {
    // ignore
  }
};

void initializeAuthAndMount();
