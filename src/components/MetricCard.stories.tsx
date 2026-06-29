import type { Meta, StoryObj } from "@storybook/react";
import MetricCard from "./MetricCard";

const meta: Meta<typeof MetricCard> = {
  title: "Components/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    value: { control: "text" },
    icon: { control: "text" },
    description: { control: "text" },
    isLoading: { control: "boolean" },
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Loaded: Story = {
  args: {
    title: "Alumnos en PPS",
    value: 128,
    icon: "groups",
    description: "Estudiantes con una práctica activa durante el ciclo.",
    isLoading: false,
  },
};

export const Clickable: Story = {
  args: {
    ...Loaded.args,
    onClick: () => alert("Card clicked!"),
  },
};

export const IsLoading: Story = {
  args: {
    title: "Alumnos en PPS",
    value: 128,
    icon: "groups",
    description: "Estudiantes con una práctica activa durante el ciclo.",
    isLoading: true,
  },
};
