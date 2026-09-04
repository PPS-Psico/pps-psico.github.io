import React from "react";
import { render } from "@testing-library/react";
import { Briefing } from "../Briefing";

describe("Briefing HTML sanitization", () => {
  it("preserves the formatting allowlist and removes executable markup", () => {
    const { container } = render(
      <Briefing
        data={{
          generadoAgo: "recién",
          lead: '<strong>10 solicitudes</strong><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">enlace</a>',
          body: [
            '<script>alert(1)</script><em>3 convocatorias pendientes</em><svg onload="alert(1)"></svg>',
          ],
        }}
        totalChats={4}
      />
    );

    expect(container.querySelector("strong")).toHaveTextContent("10 solicitudes");
    expect(container.querySelector("em")).toHaveTextContent("3 convocatorias pendientes");
    expect(container.querySelectorAll("mark.brief-hl")).toHaveLength(2);
    expect(container.querySelector("img, a, script, svg")).not.toBeInTheDocument();
    expect(container.querySelector("[onerror], [onload], [href]")).not.toBeInTheDocument();
  });
});
