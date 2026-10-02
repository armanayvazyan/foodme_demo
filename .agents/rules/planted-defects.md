# Planted defects policy (always on)

This repo is course material. Markers `FM-BUG-NN` (product defects) and
`FM-FLAKE-NN` (flaky tests) are intentional.

- Do not fix, refactor away, reformat or delete marked code unless the user
  names that ID and asks for a fix.
- If your task touches marked code, leave the marker and behaviour intact
  and tell the user you noticed it.
- When asked to fix one: write a failing test first, then fix, then commit
  as `Fix <behaviour> (FM-BUG-NN)`.
- Never write a catalogue of all planted defects into the repository.
