import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction
const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
        control: 'select',
        options: ['sm', 'md', 'lg'],
    },
    iconPosition: {
        control: 'radio',
        options: ['left', 'right'],
    },
    disabled: {
        control: 'boolean',
    },
    isLoading: {
        control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// More on writing stories with args: https://storybook.js.org/docs/react/writing-stories/args
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
};

export const WithLeftIcon: Story = {
    args: {
      variant: 'primary',
      children: 'Click Me',
      icon: 'rocket_launch',
      iconPosition: 'left',
    },
};

export const WithRightIcon: Story = {
    args: {
      variant: 'secondary',
      children: 'Go Forward',
      icon: 'arrow_forward',
      iconPosition: 'right',
    },
};

export const Loading: Story = {
    args: {
      variant: 'primary',
      children: 'This text is hidden',
      isLoading: true,
    },
};

export const Disabled: Story = {
    args: {
      variant: 'primary',
      children: 'Disabled Button',
      disabled: true,
    },
};
