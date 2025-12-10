import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from './UiButton.vue'

describe('UiButton', () => {
  it('renders slot content and default classes', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Click me' } })
    expect(wrapper.text()).toContain('Click me')
    expect(wrapper.classes()).toContain('btn')
  })

  it('applies variant and size classes', () => {
    const wrapper = mount(UiButton, { props: { variant: 'secondary', size: 'lg' } })
    expect(wrapper.classes().some(c => c.includes('secondary'))).toBe(true)
    expect(wrapper.classes().some(c => c.includes('btn-lg'))).toBe(true)
  })

  it('shows loading spinner and disabled class when loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true } })
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    expect(wrapper.classes()).toContain('btn-disabled')
  })
})
