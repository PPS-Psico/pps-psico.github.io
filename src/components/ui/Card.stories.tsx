import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Card from './Card';
import Button from './Button'; // Import our new Button component for actions

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    icon: { control: 'text' },
    titleAs: { control: 'select', options: ['h1', 'h2', 'h3'] },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <p>
        This is the content of the card. It can be any React node. You can put text, other components, or complex layouts inside.
      </p>
    ),
  },
};

export const WithTitleAndDescription: Story = {
  args: {
    title: 'Card Title',
    description: 'A short and concise description for the content of this card.',
    children: (
      <p>
        This is some additional content that appears below the header section.
      </p>
    ),
  },
};

export const WithIcon: Story = {
  args: {
    ...WithTitleAndDescription.args, // Inherit args from the previous story
    icon: 'home',
  },
};

export const WithActions: Story = {
    args: {
      title: 'Take Action',
      description: 'This card includes action buttons in the header.',
      icon: 'task_alt',
      actions: (
        <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Cancel</Button>
            <Button variant="primary" size="sm">Confirm</Button>
        </div>
      ),
      children: (
        <p>
          The content area can provide more details about the actions that can be taken.
        </p>
      ),
    },
};
