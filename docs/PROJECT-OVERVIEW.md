# Project overview

## Purpose

AI Designer No Figma creates editable native Figma layers from validated design specifications. Users can prepare prompts for an AI app they already use and paste returned JSON, or optionally use a local Ollama service. No external AI provider is mandatory.

## Current baseline

The repository contains a TypeScript Figma plugin with a React UI, schema 1.0 validation, native rendering for supported frame/group/text/shape/component/instance/vector/image nodes, local Variables and Text Styles, layout grids and responsive constraints. It includes selected-node inspection, bounded patching and undo, selected-tree export, asset import/library operations, history, a custom MCP stdio server, authenticated loopback bridge, agent job status, visual preview capture, and an optional loopback Ollama sidecar. The user confirmed the VSN loader and main plugin panel on an earlier build. The current advanced Figma operations remain unverified in a live editor.

## Runtime and stack

- Node.js 20+ project, strict TypeScript, React, Vite, esbuild, and Figma Plugin API typings.
- AJV and a versioned JSON Schema validate untrusted design data before rendering.
- Optional local Ollama generation uses structured design and patch prompts; manual JSON import remains available without a model.
- The custom MCP process and local bridge communicate with the plugin through authenticated loopback polling. They are separate from Figma's official MCP service.

## Boundaries

The plugin works only while its host document/session is open. Closing Figma or the document stops its polling session; automatic creation/opening of a different Draft document needs a separate desktop automation runner. Claude/Codex/Cursor/Gemini client-specific setup, asset access, and live pairing are not certified from local protocol tests. See [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json) and [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md).

## Start here

Read [status](PROJECT-STATUS.md), [roadmap](DEVELOPMENT-ROADMAP.md), [known issues](KNOWN-ISSUES.md), and [handoff](AI-HANDOFF.md). Do not infer completion from a plan or UI control alone.
