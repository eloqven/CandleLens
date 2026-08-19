"""Indicator computation for the server-spike mode (MD §9, §11).

Mirrors the browser engine's MA / EMA / WMA semantics so both modes agree.
Series are plain Python lists of floats; warm-up positions are returned as
None (-> JSON null) to match the TS Float64Array NaN convention.
"""

from typing import List, Optional


def sma(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if period <= 0:
        return out
    running = 0.0
    for i, v in enumerate(values):
        running += v
        if i >= period:
            running -= values[i - period]
        if i >= period - 1:
            out[i] = running / period
    return out


def ema(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if period <= 0 or not values:
        return out
    k = 2.0 / (period + 1)
    prev: Optional[float] = None
    for i, v in enumerate(values):
        if prev is None:
            if i >= period - 1:
                seed = sum(values[i - period + 1 : i + 1]) / period
                prev = seed
                out[i] = seed
        else:
            prev = v * k + prev * (1 - k)
            out[i] = prev
    return out


def wma(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if period <= 0:
        return out
    denom = period * (period + 1) / 2.0
    for i in range(period - 1, len(values)):
        s = 0.0
        for j in range(period):
            s += values[i - period + 1 + j] * (j + 1)
        out[i] = s / denom
    return out


def compute_indicator(kind: str, series: List[float], period: int) -> List[Optional[float]]:
    if kind == "MA":
        return sma(series, period)
    if kind == "EMA":
        return ema(series, period)
    if kind == "WMA":
        return wma(series, period)
    raise ValueError(f"unknown indicator kind: {kind}")
