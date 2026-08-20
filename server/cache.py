"""In-memory hot cache for the server-spike API (the load what's needed,
drop what isn't layer). Bounded LRU with prefix invalidation. Stdlib only."""

from collections import OrderedDict
from typing import Any, Dict, Optional


class Cache:
    def __init__(self, max_bytes: int = 50 * 1024 * 1024):
        self.max_bytes = max_bytes
        self._store: "OrderedDict[str, Any]" = OrderedDict()
        self._sizes: Dict[str, int] = {}
        self._bytes = 0
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            self.misses += 1
            return None
        self.hits += 1
        self._store.move_to_end(key)
        return self._store[key]

    def put(self, key: str, value: Any, size: int) -> None:
        if key in self._store:
            self._bytes -= self._sizes[key]
        self._store[key] = value
        self._sizes[key] = size
        self._bytes += size
        self._store.move_to_end(key)
        self._evict()

    def invalidate_prefix(self, prefix: str) -> int:
        removed = 0
        for k in list(self._store.keys()):
            if k.startswith(prefix):
                self._bytes -= self._sizes.pop(k, 0)
                del self._store[k]
                removed += 1
        return removed

    def _evict(self) -> None:
        while self._bytes > self.max_bytes and self._store:
            k, _ = self._store.popitem(last=False)
            self._bytes -= self._sizes.pop(k, 0)
            self.evictions += 1

    def stats(self) -> Dict[str, Any]:
        return {
            "entries": len(self._store),
            "bytes": self._bytes,
            "max_bytes": self.max_bytes,
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
        }
