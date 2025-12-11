import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineItem from './TimelineItem.vue';

describe('TimelineItem', () => {
  it('renders HIGHLIGHTED_MESSAGE as MESSAGE and shows actor', () => {
    const event = {
      id: '1',
      type: 'HIGHLIGHTED_MESSAGE',
      timestamp: new Date().toISOString(),
      message: 'Important!',
      slackUser: 'alice',
      metadata: { capturedBy: 'thumbs-up-tracker' }
    } as any;

    const wrapper = mount(TimelineItem as any, { props: { event } });

    expect(wrapper.text()).toContain('MESSAGE');
    expect(wrapper.text()).toContain('Important!');
    expect(wrapper.text()).toContain('By: alice');
  });

  it('renders MESSAGE with highlighted metadata still as MESSAGE', () => {
    const event = {
      id: '2',
      type: 'MESSAGE',
      timestamp: new Date().toISOString(),
      message: 'Another one',
      metadata: { highlighted: true, capturedBy: 'thumbs-up-tracker' }
    } as any;

    const wrapper = mount(TimelineItem as any, { props: { event } });

    expect(wrapper.text()).toContain('MESSAGE');
    expect(wrapper.text()).toContain('Another one');
    expect(wrapper.text()).toContain('By: thumbs-up-tracker');
  });

  it('renders STATUS_CHANGE as a transition using metadata', () => {
    const event = {
      id: '3',
      type: 'STATUS_CHANGE',
      timestamp: new Date().toISOString(),
      message: null,
      metadata: { fromStatus: 'OPEN', toStatus: 'INVESTIGATING', actorName: 'bob' }
    } as any;

    const wrapper = mount(TimelineItem as any, { props: { event } });

    expect(wrapper.text()).toContain('STATUS_CHANGE');
    expect(wrapper.text()).toContain('Open -> Investigating');
    expect(wrapper.text()).toContain('By: bob');
  });
});
