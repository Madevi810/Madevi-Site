import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import postcss from "postcss";

test("theme keeps shared hero colors for both light and dark", () => {
  const root = postcss.parse(readFileSync("src/app/globals.css", "utf8"));
  const themes = new Map<string, Set<string>>();
  root.walkRules(rule => {
    if ([":root", "html[data-theme=dark]"].includes(rule.selector)) {
      const declarations = new Set<string>();
      rule.walkDecls(declaration => declarations.add(declaration.prop));
      themes.set(rule.selector, declarations);
    }
  });
  for(const theme of [":root", "html[data-theme=dark]"]) {
    for(const name of ["--madevi-hero-bg", "--madevi-hero-text", "--madevi-hero-accent", "--madevi-hero-description", "--madevi-hero-art", "--madevi-hero-gradient"])
      assert.ok(themes.get(theme)?.has(name), `${theme} is missing ${name}`);
  }
});

test("global stylesheet keeps only global elements, fonts, themes and keyframes", () => {
  const root = postcss.parse(readFileSync("src/app/globals.css", "utf8"));
  const selectors: string[] = [];
  root.walkRules(rule => {if (/(^|[\s>,+~])\.[a-zA-Z_][\w-]*/.test(rule.selector)) selectors.push(rule.selector)});
  assert.deepEqual(selectors, [], "component selectors must use the shared utilities");
});
