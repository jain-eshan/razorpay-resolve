"""Small tail probabilities for the Zone 1 monitors. Standard library only."""
import math


def poisson_cdf(k: int, lam: float) -> float:
    """P(X <= k) for X ~ Poisson(lam)."""
    if k < 0:
        return 0.0
    term = total = math.exp(-lam)
    for i in range(1, k + 1):
        term *= lam / i
        total += term
    return min(total, 1.0)


def poisson_sf(k: int, lam: float) -> float:
    """P(X >= k): the chance of seeing at least k when lam is normal."""
    return 1.0 if k <= 0 else max(1.0 - poisson_cdf(k - 1, lam), 0.0)


def binom_sf(k: int, n: int, p: float) -> float:
    """P(X >= k) for X ~ Binomial(n, p)."""
    return sum(math.comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(k, n + 1))
