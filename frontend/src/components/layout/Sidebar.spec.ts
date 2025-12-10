import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

// Mock vue-router to provide useRoute and RouterLink
vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'incidents' }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    // render an anchor with class and slot
    template: `<a :class="$attrs.class"><slot /></a>`
  }
}))

import Sidebar from './Sidebar.vue'

describe('Sidebar', () => {
  it('marks the active route item', () => {
    const wrapper = mount(Sidebar, {
      global: {
        plugins: [createPinia()],
      },
    })
    // the active item should have font-medium or bg-base-200 class applied
    const links = wrapper.findAll('a')
    expect(links.length).toBeGreaterThan(0)
    // first link is Incidents and should be active (route name mocked)
    expect(links[0].classes().some(c => c.includes('font-medium') || c.includes('bg-base-200'))).toBe(true)
  })
})
