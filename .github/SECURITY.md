# Security

## Supported versions

The latest 1.x release. Versions 0.x are deprecated and will not receive fixes.

## Reporting a vulnerability

Please report privately rather than opening an issue, either through
[GitHub's private advisory form](https://github.com/nord-forge/oklch-picker/security/advisories/new)
or by email to hello@nickbevers.dev.

Expect an acknowledgement within a few days. If the report is confirmed, a fix
goes out as a patch release across all six packages and the advisory is
published with credit, unless you would rather not be named.

## Scope

This is a client-side colour picker with no network access, no storage, and no
runtime dependencies, so the realistic surface is small. Worth reporting:

- Anything in the packages' supply chain, such as a dependency of the build or
  a compromised release artefact.
- Input handling that could be turned into script execution: the `value`
  attribute and hex field accept arbitrary strings, and the custom element
  renders into the light DOM.

Colour values that render unexpectedly, or clamp differently than you expected,
are bugs rather than vulnerabilities. Please open a normal issue for those.
