/**
 * The site's page map, in reading order.
 *
 * The sidebar renders this; later phases fill in the pages. A link here whose
 * page does not exist yet is a build error under `astro check`, so this list
 * and `src/pages/` cannot drift apart silently.
 */
export interface NavItem {
  readonly title: string;
  readonly path: string;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const NAV: readonly NavSection[] = [
  {
    title: "Getting started",
    items: [
      { title: "Introduction", path: "/" },
      { title: "Install", path: "/docs/install" },
      { title: "Usage", path: "/docs/usage" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Layouts", path: "/docs/layouts" },
      { title: "Wider gamuts", path: "/docs/gamuts" },
      { title: "Recent colours", path: "/docs/recents" },
      { title: "Hiding parts", path: "/docs/parts" },
      { title: "Styling", path: "/docs/styling" },
      { title: "Accessibility", path: "/docs/accessibility" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "Colour utilities", path: "/docs/utilities" },
      { title: "API", path: "/api" },
      { title: "Playground", path: "/playground" },
    ],
  },
];
