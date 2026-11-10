import type { ServerEvent } from "@tether/contract";

export type Listener = (event: ServerEvent) => void;

/** Fan-out of every state change. The store publishes; SSE connections subscribe. */
export class Bus {
  private listeners = new Set<Listener>();

  emit(event: ServerEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // A broken subscriber must not stop the others.
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get size(): number {
    return this.listeners.size;
  }
}
