import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    meta: {},
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
  RouterView: {
    name: 'RouterView',
    template: '<div />',
  },
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  }
}))

describe('App.vue', () => {
  it('renders without crashing', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
