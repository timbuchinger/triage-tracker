<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import UiCard from "@/components/ui/UiCard.vue";
import UiFormField from "@/components/ui/UiFormField.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiButton from "@/components/ui/UiButton.vue";

const router = useRouter();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const errorMessage = ref("");

const handleLogin = async () => {
  errorMessage.value = "";

  if (!email.value || !password.value) {
    errorMessage.value = "Please enter both email and password";
    return;
  }

  const success = await authStore.login(email.value, password.value);

  if (success) {
    // Use nextTick and replace to avoid browser extension errors during navigation
    await nextTick();
    const redirect = router.currentRoute.value.query.redirect as string;
    router.replace(redirect || "/");
  } else {
    errorMessage.value = authStore.error || "Login failed";
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="w-full max-w-md px-4">
      <UiCard>
        <template #header>
          <h1 class="text-2xl font-bold">Triage Tracker</h1>
          <p class="text-sm text-base-content/70 mt-1">Sign in to your account</p>
        </template>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <UiFormField label="Email" required>
            <UiInput
              v-model="email"
              type="email"
              placeholder="admin@example.com"
              autocomplete="email"
              :disabled="authStore.loading"
            />
          </UiFormField>

          <UiFormField label="Password" required>
            <UiInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              :disabled="authStore.loading"
            />
          </UiFormField>

          <div v-if="errorMessage" class="alert alert-error min-w-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="flex-1 min-w-0">
              <span class="block break-all whitespace-normal max-w-full">{{ errorMessage }}</span>
            </div>
          </div>

          <UiButton type="submit" variant="primary" class="w-full" :loading="authStore.loading">
            {{ authStore.loading ? "Signing in..." : "Sign in" }}
          </UiButton>
        </form>

        <template #footer>
          <div class="text-sm text-base-content/70">
            <p><strong>Development credentials:</strong></p>
            <p>Email: admin@example.com | Password: password123</p>
          </div>
        </template>
      </UiCard>
    </div>
  </div>
</template>
