import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

function renderHeader(overrides?: {
  templates?: Array<{ id: string; name: string }>;
  activeTemplateId?: string;
  greetingName?: string | null;
  isSignedIn?: boolean;
}) {
  const templates = overrides?.templates ?? [
    { id: "template-1", name: "Template 1" },
  ];
  const props = {
    view: "calendar" as const,
    language: "en" as const,
    greetingName: overrides?.greetingName ?? null,
    isSignedIn: overrides?.isSignedIn ?? false,
    templates,
    activeTemplateId: overrides?.activeTemplateId ?? templates[0]?.id,
    onViewChange: vi.fn(),
    onTemplateChange: vi.fn(),
    onApplyTemplateToCalendar: vi.fn(),
    onOpenCreateTemplate: vi.fn(),
    onOpenEditTemplate: vi.fn(),
    onOpenDuplicateTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onOpenAuth: vi.fn(),
  };

  render(<AppHeader {...props} />);
  return props;
}

describe("AppHeader", () => {
  it("requests graph view when selecting Graphs", () => {
    const props = renderHeader();

    fireEvent.click(screen.getByRole("tab", { name: "Graphs" }));

    expect(props.onViewChange).toHaveBeenCalledWith("graph");
  });

  it("requests exercises view when selecting Exercises", () => {
    const props = renderHeader();

    fireEvent.click(screen.getByRole("tab", { name: "Exercises" }));

    expect(props.onViewChange).toHaveBeenCalledWith("exercises");
  });

  it("applies selected template to calendar from action menu", () => {
    const props = renderHeader();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Add to calendar/i, hidden: true })[0],
    );

    expect(props.onApplyTemplateToCalendar).toHaveBeenCalledTimes(1);
  });

  it("opens create-template flow from template dropdown action", () => {
    const props = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /New template/i, hidden: true }));

    expect(props.onOpenCreateTemplate).toHaveBeenCalledTimes(1);
  });

  it("opens duplicate-template flow from template dropdown action", () => {
    const props = renderHeader();

    fireEvent.click(screen.getAllByRole("button", { name: "Duplicate template", hidden: true })[0]);

    expect(props.onOpenDuplicateTemplate).toHaveBeenCalledWith("template-1");
  });

  it("opens edit-template flow from template dropdown action", () => {
    const props = renderHeader();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit template", hidden: true })[0]);

    expect(props.onOpenEditTemplate).toHaveBeenCalledWith("template-1");
  });

  it("requests delete from template action menu", () => {
    const props = renderHeader();

    expect(
      screen.getAllByRole("button", { name: "Delete template", hidden: true })[0],
    ).toBeDisabled();

    expect(props.onDeleteTemplate).not.toHaveBeenCalled();
  });

  it("requests delete when multiple templates are available", () => {
    const props = renderHeader({
      templates: [
        { id: "template-1", name: "Template 1" },
        { id: "template-2", name: "Template 2" },
      ],
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete template", hidden: true })[0]);

    expect(props.onDeleteTemplate).toHaveBeenCalledWith("template-1");
  });

  it("requests template change when selecting a template id", () => {
    const props = renderHeader({
      templates: [
        { id: "template-1", name: "Template 1" },
        { id: "template-2", name: "Template 2" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Template 2", hidden: true }));

    expect(props.onTemplateChange).toHaveBeenCalledWith("template-2");
  });

});
