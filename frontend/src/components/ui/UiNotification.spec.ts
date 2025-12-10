import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiNotification from './UiNotification.vue'

describe('UiNotification', () => {
  it('renders message and details and type classes', () => {
    const wrapper = mount(UiNotification, {
      props: { type: 'warning', message: 'Watch out', details: 'More info' }
    })

    expect(wrapper.text()).toContain('Watch out')
    expect(wrapper.text()).toContain('More info')
    expect(wrapper.classes().some(c => c.includes('alert-warning'))).toBe(true)
  })

  it('emits dismiss when dismiss button clicked', async () => {
    const wrapper = mount(UiNotification, {
      props: { type: 'info', message: 'Hello', dismissible: true }
    })

    const btn = wrapper.find('button[aria-label="Dismiss notification"]')
    await btn.trigger('click')
    expect(wrapper.emitted()).toHaveProperty('dismiss')
  })
})
