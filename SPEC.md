# String CRDT

- Server saves all deltas as-is
- When client connects, it gets the complete state via GET, subscribes to deltas via nes-ws
