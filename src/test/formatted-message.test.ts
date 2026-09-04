import { describe, it, expect } from "vitest";
import React from "react";
import { renderFormattedMessageContent } from "@/components/FormattedMessage";

describe("renderFormattedMessageContent", () => {
  it("renders null for empty or null content", () => {
    expect(renderFormattedMessageContent("")).toBeNull();
  });

  it("parses standard markdown links correctly", () => {
    const content = "Check this [Tesla](https://tesla.com) report.";
    const result = renderFormattedMessageContent(content);
    expect(result).toBeTruthy();
    expect(Array.isArray(result)).toBe(true);
    const elements = result as React.ReactNode[];
    // Should have text before, link, and text after
    expect(elements.length).toBeGreaterThanOrEqual(2);
    const linkElement = elements.find(
      (el) => React.isValidElement(el) && el.type === "a"
    ) as React.ReactElement<{ href: string; children: React.ReactNode }> | undefined;
    expect(linkElement).toBeDefined();
    expect(linkElement?.props.href).toBe("https://tesla.com");
  });

  it("handles LLM delimiter mismatch where URL opens with '(' and closes with ']'", () => {
    const content =
      "A fatal crash happened [Electrek](https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5...oc=5]—can feel more salient.";
    const result = renderFormattedMessageContent(content) as React.ReactNode[];
    const linkElement = result.find(
      (el) => React.isValidElement(el) && el.type === "a"
    ) as React.ReactElement<{ href: string }> | undefined;
    expect(linkElement).toBeDefined();
    expect(linkElement?.props.href).toContain("https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5...oc=5");
  });

  it("handles LLM double bracket references and spaces", () => {
    const content = "See [Source 1][https://source1.com] and [Source 2] (https://source2.com).";
    const result = renderFormattedMessageContent(content) as React.ReactNode[];
    const links = result.filter(
      (el) => React.isValidElement(el) && el.type === "a"
    ) as React.ReactElement<{ href: string }>[];
    expect(links.length).toBe(2);
    expect(links[0].props.href).toBe("https://source1.com");
    expect(links[1].props.href).toBe("https://source2.com");
  });

  it("handles consecutive citations without spaces or with spaces", () => {
    const content = "Data shows 9x safer [Teslarati](https://teslarati.com/) [vfuturemedia](https://vfuturemedia.com/).";
    const result = renderFormattedMessageContent(content) as React.ReactNode[];
    const links = result.filter(
      (el) => React.isValidElement(el) && el.type === "a"
    ) as React.ReactElement<{ href: string }>[];
    expect(links.length).toBe(2);
    expect(links[0].props.href).toBe("https://teslarati.com/");
    expect(links[1].props.href).toBe("https://vfuturemedia.com/");
  });

  it("renders the exact broken message from the user report successfully", () => {
    const rawContent = `Tesla's latest safety report shows 8 billion cumulative miles [Teslarati](https://www.teslarati.com/tesla-fsd-supervised-8-billion-miles/) [vfuturemedia](https://vfuturemedia.com/analysis/). Tesla also maintains an evidence dashboard [Tesla](https://www.tesla.com/fsd-evidence-dashboard).

A single fatal crash [Electrek](https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5UTNwSmdNUW9MNE1ac0ZJbmRsc1pOVms5a2ZYUzFtVDIyYkNid1VFMnhjNExLcTBOYkVPS3h4TmJ2UGZBYVJaQlNzVk9fcDZYd1YwSmY1RG1KcWc3R3JvNlg4UUtRUGkxNDUzTGRXaG5DRVZ4VmtoMA?oc=5]—can feel more salient. And Tesla's own data confirms that incident [Electrek](https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5UTNwSmdNUW9MNE1ac0ZJbmRsc1pOVms5a2ZYUzFtVDIyYkNid1VFMnhjNExLcTBOYkVPS3h4TmJ2UGZBYVJaQlNzVk9fcDZYd1YwSmY1RG1KcWc3R3JvNlg4UUtRUGkxNDUzTGRXaG5DRVZ4VmtoMA?oc=5].`;

    const result = renderFormattedMessageContent(rawContent) as React.ReactNode[];
    const links = result.filter(
      (el) => React.isValidElement(el) && el.type === "a"
    ) as React.ReactElement<{ href: string }>[];

    // All 5 links must be parsed into <a> anchor tags!
    expect(links.length).toBe(5);
    expect(links[0].props.href).toBe("https://www.teslarati.com/tesla-fsd-supervised-8-billion-miles/");
    expect(links[1].props.href).toBe("https://vfuturemedia.com/analysis/");
    expect(links[2].props.href).toBe("https://www.tesla.com/fsd-evidence-dashboard");
    expect(links[3].props.href).toContain("https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5UTNwSmdNUW9MNE1ac0ZJbmRsc1pOVms5a2ZYUzFtVDIyYkNid1VFMnhjNExLcTBOYkVPS3h4TmJ2UGZBYVJaQlNzVk9fcDZYd1YwSmY1RG1KcWc3R3JvNlg4UUtRUGkxNDUzTGRXaG5DRVZ4VmtoMA?oc=5");
    expect(links[4].props.href).toContain("https://news.google.com/rss/articles/CBMigAFBVV95cUxPMHpXOUlqZzU5UTNwSmdNUW9MNE1ac0ZJbmRsc1pOVms5a2ZYUzFtVDIyYkNid1VFMnhjNExLcTBOYkVPS3h4TmJ2UGZBYVJaQlNzVk9fcDZYd1YwSmY1RG1KcWc3R3JvNlg4UUtRUGkxNDUzTGRXaG5DRVZ4VmtoMA?oc=5");
  });
});
