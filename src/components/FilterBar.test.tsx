import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "./FilterBar";

const types = [
  { id: "lift", name: "Lift", color: "#111" },
  { id: "run", name: "Run", color: "#222" },
];

describe("FilterBar", () => {
  it("emits selected type when toggled", () => {
    const onChange = vi.fn();

    render(
      <FilterBar
        language="en"
        selectedTypeIds={[]}
        types={types}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lift" }));

    expect(onChange).toHaveBeenCalledWith(["lift"]);
  });

  it("resets to all types when all become selected", () => {
    const onChange = vi.fn();

    render(
      <FilterBar
        language="en"
        selectedTypeIds={["lift"]}
        types={types}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
