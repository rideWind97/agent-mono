import type { AgentMemory } from "./types.js";

export function createMemory(seed?: Partial<AgentMemory>): AgentMemory {
  return {
    shortTerm: seed?.shortTerm ? [...seed.shortTerm] : [],
    longTerm: seed?.longTerm ? { ...seed.longTerm } : {},
  };
}

export function pushShortTerm(memory: AgentMemory, item: string): void {
  memory.shortTerm.push(item);
  if (memory.shortTerm.length > 12) {
    memory.shortTerm.shift();
  }
}

export function writeLongTerm(memory: AgentMemory, key: string, value: string): void {
  memory.longTerm[key] = value;
}
