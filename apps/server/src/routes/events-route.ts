import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { subscribe } from '../scan/watcher';

export const eventsRoute = new Hono();

eventsRoute.get('/', (c) =>
  streamSSE(c, async (stream) => {
    let open = true;
    const queue: { event: string; data: unknown }[] = [];
    const unsubscribe = subscribe((event, data) => {
      queue.push({ event, data });
    });
    stream.onAbort(() => {
      open = false;
      unsubscribe();
    });
    await stream.writeSSE({ event: 'ready', data: '1' });
    while (open) {
      const next = queue.shift();
      if (next) {
        await stream.writeSSE({ event: next.event, data: JSON.stringify(next.data) });
        continue;
      }
      await stream.sleep(300);
    }
  })
);
