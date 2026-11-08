# Project overview

## Purpose

AI Designer No Figma turns validated structured design specifications into editable native Figma layers. Users can prepare prompts for an AI app they already use and paste the returned JSON, or optionally use a local Ollama service. No external AI provider is mandatory.

## Current baseline

This repository contains a TypeScript Figma plugin with React UI, schema 1.0 validation, native rendering for text/frame/group/rectangle/ellipse/line nodes, selected-node inspection and editing, selected-layer export, local color tokens/history, optional loopback Ollama HTTP service, automated unit/integration tests, build and ZIP packaging. The user confirmed the VSN loader and main plugin UI work after reimport. Recent selected-export and patch-undo additions are build/test verified but not yet live checked.

There is no MCP server-to-plugin bridge, remote agent session, AI activity/job feed, compatibility engine, visual screenshot analyzer, component/variable renderer, or full-page document exporter yet. See [`FEATURE-REGISTRY.json`](FEATURE-REGISTRY.json) for separate implementation and test statuses.

## Runtime and stack

- Node.js 20+ project, TypeScript strict mode, React 19, Vite, esbuild, Figma Plugin API typings.
- Shared AJV design-spec validator and versioned JSON Schema.
- Optional Node HTTP Ollama sidecar binds to 127.0.0.1 and uses no paid inference endpoint.
- Official open-source MCP TypeScript SDK dependency was added for the new extension; the MCP server itself is not yet implemented.

## Start here

Read [status](PROJECT-STATUS.md), [roadmap](DEVELOPMENT-ROADMAP.md), [known issues](KNOWN-ISSUES.md), and [handoff](AI-HANDOFF.md). Do not infer completion from an earlier plan or from a UI control alone.
