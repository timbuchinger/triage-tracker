<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { badges } from '@/design/tokens';

const props = defineProps<{
  modelValue: 'OWNER' | 'MEMBER';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: 'OWNER' | 'MEMBER'];
}>();

const isOpen = ref(false);
const dropdownRef = ref<HTMLDivElement | null>(null);

const roles = [
  { value: 'MEMBER', label: 'Member', colorClass: badges.roleMember },
  { value: 'OWNER', label: 'Admin', colorClass: badges.roleOwner },
] as const;

const selectedRole = computed(() => 
  roles.find(r => r.value === props.modelValue) || roles[0]
);

const selectRole = (role: typeof roles[number]) => {
  if (role.value !== props.modelValue) {
    emit('update:modelValue', role.value);
  }
  isOpen.value = false;
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block">
    <button
      type="button"
      @click="toggleDropdown"
      class="badge cursor-pointer hover:brightness-110 transition-all"
      :class="selectedRole.colorClass"
    >
      {{ selectedRole.label }}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke-width="2" 
        stroke="currentColor" 
        class="w-3 h-3 ml-1 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 bg-base-100 border border-base-300 rounded-md shadow-lg min-w-[120px] right-0"
    >
      <button
        v-for="role in roles"
        :key="role.value"
        type="button"
        @click="selectRole(role)"
        class="w-full px-3 py-2 text-left hover:bg-base-200 first:rounded-t-md last:rounded-b-md flex items-center gap-2"
      >
        <span class="badge" :class="role.colorClass">
          {{ role.label }}
        </span>
      </button>
    </div>
  </div>
</template>
