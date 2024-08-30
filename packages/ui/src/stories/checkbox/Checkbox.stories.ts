import DemoCheckbox from './DemoCheckbox.svelte';
import type { Meta, StoryObj } from '@storybook/svelte';

const meta = {
	title: 'Inputs / Checkbox',
	component: DemoCheckbox
} satisfies Meta<DemoCheckbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CheckboxStory: Story = {
	name: 'Checkbox',
	args: {
		name: 'Checkbox',
		checked: false,
		disabled: false,
		indeterminate: false,
		small: false
	}
};