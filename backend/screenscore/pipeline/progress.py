"""In-process progress pub/sub for pipeline runs.

Events for a run are kept in history so an SSE subscriber that connects
mid-run (or reconnects) replays everything before going live. Terminal event
types ("done", "failed") end every stream.
"""

import asyncio

TERMINAL_TYPES = {"done", "failed"}


class ProgressBus:
    def __init__(self) -> None:
        self._history: dict[str, list[dict]] = {}
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    def publish(self, run_id: str, event: dict) -> None:
        history = self._history.setdefault(run_id, [])
        event = {**event, "seq": len(history)}
        history.append(event)
        for queue in self._subscribers.get(run_id, []):
            queue.put_nowait(event)

    async def stream(self, run_id: str):
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(run_id, []).append(queue)
        try:
            replayed = self._history.get(run_id, [])[:]
            last_seq = -1
            for event in replayed:
                yield event
                last_seq = event["seq"]
                if event["type"] in TERMINAL_TYPES:
                    return
            while True:
                event = await queue.get()
                if event["seq"] <= last_seq:  # already replayed from history
                    continue
                yield event
                if event["type"] in TERMINAL_TYPES:
                    return
        finally:
            self._subscribers[run_id].remove(queue)

    def finished(self, run_id: str) -> bool:
        history = self._history.get(run_id, [])
        return bool(history) and history[-1]["type"] in TERMINAL_TYPES
