import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiSkeleton from './UiSkeleton.vue'

describe('UiSkeleton', () => {
  it('renders with default classes', () => {
    const wrapper = mount(UiSkeleton)
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.classes()).toContain('skeleton')
  })

  it('applies variant and rounded props', () => {
    const wrapper = mount(UiSkeleton, { props: { variant: 'text', rounded: 'lg' } })
    // skeleton-text should be applied for text variant
    expect(wrapper.classes()).toContain('skeleton-text')
    expect(wrapper.classes()).toContain('rounded-lg')
  })

  it('renders sr-only label when provided', () => {
    const wrapper = mount(UiSkeleton, { props: { label: 'Loading data' } })
    expect(wrapper.find('span.sr-only').exists()).toBe(true)
    expect(wrapper.find('span.sr-only').text()).toBe('Loading data')
  })
})
