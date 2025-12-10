import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import TopNav from './TopNav.vue'

describe('TopNav', () => {
  beforeEach(() => {
    // reset document attributes and localStorage
    document.documentElement.removeAttribute('data-theme')
    document.body.removeAttribute('data-theme')
    localStorage.removeItem('triage-theme')
  })

  it('applies initial theme from localStorage on mount', () => {
    localStorage.setItem('triage-theme', 'nord-dark')
    mount(TopNav, {
      global: {
        plugins: [createPinia()],
        // stub UiButton so clicks are forwarded
        components: {
          UiButton: {
            template: '<button @click="$emit(\'click\')"><slot/></button>'
          }
        }
      }
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('nord-dark')
  })

  it('changes theme when button is clicked', async () => {
    const wrapper = mount(TopNav, {
      global: {
        plugins: [createPinia()],
        components: {
          UiButton: {
            template: '<button @click="$emit(\'click\')"><slot/></button>'
          }
        }
      }
    })

    // click the second theme button (Dark)
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    const stored = localStorage.getItem('triage-theme')
    expect(stored).toBe('nord-dark')
  })
})
