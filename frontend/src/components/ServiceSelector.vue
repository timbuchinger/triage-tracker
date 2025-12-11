<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

export interface ServiceOption {
  id: string;
  name: string;
}

const props = defineProps<{
  modelValue: string | null;
  services: ServiceOption[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLDivElement | null>(null);
const buttonRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);

const selectedService = computed(() => 
  props.services.find(s => s.id === props.modelValue) || null
);

const selectService = (serviceId: string | null) => {
  if (serviceId !== props.modelValue) {
    emit('update:modelValue', serviceId);
  }
  isOpen.value = false;
};

const updateMenuPosition = () => {
  if (!buttonRef.value || !menuRef.value) return;
  
  const buttonRect = buttonRef.value.getBoundingClientRect();
  const menu = menuRef.value;
  
  menu.style.top = `${buttonRect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${buttonRect.right + window.scrollX - menu.offsetWidth}px`;
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    setTimeout(updateMenuPosition, 0);
  }
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('scroll', updateMenuPosition, true);
  window.addEventListener('resize', updateMenuPosition);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('scroll', updateMenuPosition, true);
  window.removeEventListener('resize', updateMenuPosition);
});
</script>

<template>
  <div ref="dropdownRef" class="inline-block">
    <button
      ref="buttonRef"
      type="button"
      @click="toggleDropdown"
      class="text-sm font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
    >
      <span>{{ selectedService?.name || 'Not linked' }}</span>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke-width="2" 
        stroke="currentColor" 
        class="w-3 h-3 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="fixed z-50 bg-base-100 border border-base-300 rounded-md shadow-lg min-w-[160px] max-h-[300px] overflow-y-auto"
      >
        <button
          type="button"
          @click="selectService(null)"
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 first:rounded-t-md"
          :class="{ 'bg-base-200': !selectedService }"
        >
          <span class="text-base-content/60">Not linked</span>
        </button>
        <button
          v-for="service in services"
          :key="service.id"
          type="button"
          @click="selectService(service.id)"
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 last:rounded-b-md"
          :class="{ 'bg-base-200': selectedService?.id === service.id }"
        >
          {{ service.name }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
