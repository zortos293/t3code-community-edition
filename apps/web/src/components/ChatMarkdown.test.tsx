import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ChatMarkdown from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  it("renders standalone file URLs with file-link behavior", () => {
    const html = renderToStaticMarkup(
      <ChatMarkdown text="<file:///home/project/src/index.ts#L12>" cwd="/home/project" />,
    );

    expect(html).toContain("chat-markdown-file-link");
    expect(html).toContain("index.ts");
    expect(html).toContain("L12");
  });
});
