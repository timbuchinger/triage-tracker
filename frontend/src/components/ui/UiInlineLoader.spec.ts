import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiInlineLoader from './UiInlineLoader.vue'

describe('UiInlineLoader', () => {
  it('renders with default classes and sr-only label', () => {
    const wrapper = mount(UiInlineLoader)
    expect(wrapper.classes()).toContain('loading-spinner')
    expect(wrapper.find('span.sr-only').exists()).toBe(true)
  })

  it('applies size class prop', () => {
    const wrapper = mount(UiInlineLoader, { props: { size: 'lg' } })
    expect(wrapper.classes().some(c => c.includes('loading-lg'))).toBe(true)
  })
})
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiInlineLoader from './UiInlineLoader.vue'

describe('UiInlineLoader', () => {
  it('renders default loader', () => {
    const wrapper = mount(UiInlineLoader)
    expect(wrapper.classes()).toContain('loading')
    expect(wrapper.classes()).toContain('loading-sm')
  })

  it('applies size prop', () => {
    const wrapper = mount(UiInlineLoader, { props: { size: 'xs' } })
    expect(wrapper.classes()).toContain('loading-xs')
  })
})
