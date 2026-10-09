import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Grace Community Church")).toBe("grace-community-church");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("St. Mary's  --  Nairobi!!")).toBe("st-marys-nairobi");
  });
});

describe("uniqueSlug", () => {
  it("appends a random suffix", () => {
    const slug = uniqueSlug("Hope Church");
    expect(slug.startsWith("hope-church-")).toBe(true);
    expect(slug.length).toBeGreaterThan("hope-church-".length);
  });
});