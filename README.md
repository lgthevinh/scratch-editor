# thingblock-editor: The ThingBlock Editor Monorepo

ThingBlock Editor is a block-based firmware development IDE for Arduino-compatible hardware. It keeps the
beginner-friendly Scratch programming model while adding the hardware workflow needed for physical computing: board
selection, generated Arduino code, native board-link discovery, upload flow foundations, and a serial monitor for
device input and output.

ThingBlock is a fork of the open-source `scratch-editor` project. The Scratch-derived package names, workspace
layout, and architecture are intentionally preserved in many places so the fork remains understandable, compatible with
upstream Scratch packages, and easier to compare against the original project.

## What's in this repository?

The `packages` directory contains:

- `scratch-gui` provides the editor UI, including the ThingBlock menu bar, board picker, generated-code panel, and
  serial monitor.
- `scratch-vm` is the virtual machine that runs Scratch projects and owns device registration, code generation, and
  native board-link discovery.
- `scratch-blocks` is the Blockly-based block editor fork used by the GUI.
- `scratch-render` draws backdrops, sprites, clones, and stage content.
- `scratch-storage` loads project assets like images and sounds.
- `scratch-svg-renderer` processes SVG assets.
- `scratch-paint` contains the costume/paint editor package.
- `scratch-media-lib-scripts` builds media library assets.
- `task-herder` manages queues of tasks with throttling and concurrency limits.

## Project direction

ThingBlock focuses on physical computing education and beginner-friendly firmware development. The goal is to let
learners build real hardware projects with the same drag-and-drop style that makes Scratch approachable, while giving
boards, extensions, code generation, upload, and monitor features clear ownership inside the editor and VM.

The longer-term direction is a reusable hardware extension platform: new Arduino-compatible boards should be addable
without rewriting the core editor, and device-specific behavior should live behind well-defined board, link, codegen,
and upload surfaces.
