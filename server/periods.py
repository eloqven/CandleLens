"""Period generation for indicator lines (mirrors src/indicators/periods.ts)."""

def fibonacci_up_to(max_p: int):
    out = []
    a, b = 1, 2
    while a <= max_p:
        out.append(a)
        a, b = b, a + b
    return out

def generate_periods(min_p: int, max_p: int, mode: str, step: int = 1, divisor: int = None):
    lo = max(1, int(min_p))
    hi = int(max_p)
    if hi < lo:
        return []
    if mode == "sequential":
        if not isinstance(step, int) or step < 1:
            raise ValueError(f"sequential step must be a positive integer, got {step}")
        return list(range(lo, hi + 1, step))
    if mode == "fibonacci":
        return [p for p in fibonacci_up_to(hi) if p >= lo]
    if mode == "divisible":
        if divisor is None or not isinstance(divisor, int) or divisor < 1:
            raise ValueError(f"divisible mode requires a positive integer divisor, got {divisor}")
        p = lo
        rem = p % divisor
        if rem != 0:
            p += divisor - rem
        return list(range(p, hi + 1, divisor))
    raise ValueError(f"unknown period mode: {mode}")

def count_periods(min_p: int, max_p: int, mode: str, step: int = 1, divisor: int = None):
    return len(generate_periods(min_p, max_p, mode, step, divisor))
