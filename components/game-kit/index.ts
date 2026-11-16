// The game kit, in one import for React code: `import { useToasts, GameWindow, formatNumber } from "@/components/game-kit"`.
// Engines (lib/<game>) must import the pure parts by relative path instead (lib/game-kit/*), so node tests can load them.
// Docs: docs/game-kit.md.
export * from "./hooks";
export * from "./use-toasts";
export * from "./use-window";
export * from "./ui";
export * from "@/lib/game-kit";
