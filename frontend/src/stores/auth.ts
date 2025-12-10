import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "@/api/auth";
import { setAccessToken } from "@/api/client";

export interface User {
  id: string;
  email: string;
  name?: string;
  organizationId: string;
  role: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => user.value !== null);
  const isOwner = computed(() => user.value?.role === "OWNER");

  async function login(email: string, password: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await authApi.login({ email, password });
      user.value = response.user;
      accessToken.value = response.accessToken;
      setAccessToken(response.accessToken);

      // Store in localStorage for persistence
      localStorage.setItem("user", JSON.stringify(response.user));
      localStorage.setItem("accessToken", response.accessToken);

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Login failed";
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      user.value = null;
      accessToken.value = null;
      setAccessToken(null);
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
    }
  }

  async function refresh() {
    try {
      const response = await authApi.refreshToken();
      user.value = response.user;
      accessToken.value = response.accessToken;
      setAccessToken(response.accessToken);

      localStorage.setItem("user", JSON.stringify(response.user));
      localStorage.setItem("accessToken", response.accessToken);

      return true;
    } catch (err) {
      console.error("Token refresh failed:", err);
      await logout();
      return false;
    }
  }

  function loadFromStorage() {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("accessToken");

    if (storedUser && storedToken) {
      try {
        user.value = JSON.parse(storedUser);
        accessToken.value = storedToken;
        setAccessToken(storedToken);
      } catch (err) {
        console.error("Failed to load auth from storage:", err);
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
      }
    }
  }

  return {
    user,
    accessToken,
    loading,
    error,
    isAuthenticated,
    isOwner,
    login,
    logout,
    refresh,
    loadFromStorage,
  };
});
