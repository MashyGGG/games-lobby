export class EventBus {
  constructor() { this.listeners = new Map(); }

  on(eventName, listener) {
    const bucket = this.listeners.get(eventName) ?? new Set();
    bucket.add(listener);
    this.listeners.set(eventName, bucket);
    return () => bucket.delete(listener);
  }

  emit(eventName, payload) {
    for (const listener of this.listeners.get(eventName) ?? []) listener(payload);
    for (const listener of this.listeners.get('*') ?? []) listener({ eventName, payload });
  }

  clear() { this.listeners.clear(); }
}
