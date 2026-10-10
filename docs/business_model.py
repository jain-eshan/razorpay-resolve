"""Business case model for Blindspot. Source of every number in docs/BUSINESS_CASE.md.

Run: uv run python docs/business_model.py
Standard library only. Seeded, so the output is the same every run. Money is in rupees unless a name ends in
_cr (crore, 1e7) or _lakh. The BASE dict is the frozen base case (see docs/BUSINESS_CASE.md section 2). Change it
only with an entry in the change log of that file.
"""

import random

FX = 90  # rupees per US dollar
WA_UTILITY, WA_MARKETING = 0.115, 0.8631  # Meta India rates per delivered message
LLM = {"Haiku": (0.10, 0.01, 0.50), "Sonnet": (2.0, 0.10, 10.0), "Fable": (10.0, 0.25, 50.0)}  # $/M: in, cached, out
CUSTOMERS = {"small": 25, "mid": 120, "large": 1000}  # customers hit per incident, before cust_mult
RAMP = (0.20, 0.55, 1.0)  # share of steady state reached in years 1, 2, 3
SENIOR_SWE_LAKH, ANALYST_LAKH, EM_LAKH = 35.5, 14.8, 65.0  # AmbitionBox, Razorpay, 8 Oct 2026 (midpoints)
OVERHEAD = 1.25  # benefits, tools, equipment on top of cash plus ESOP


def squad_cost(cash_lakh, esop):
    """Lakh per person-month and lakh per year for the build squad (ISB AIPM / full-stack builder pay)."""
    builder = cash_lakh * (1 + esop)
    annual = 1.5 * builder + SENIOR_SWE_LAKH + 0.25 * ANALYST_LAKH + 0.1 * EM_LAKH
    fte = 2.85
    return annual * OVERHEAD / fte / 12, annual * OVERHEAD


BASE = dict(
    onboarded=10e6, active=0.10, webhook_share=0.50, connected=0.08,
    rate_sm=0.40, rate_lg=0.20, elig=0.70, recall=0.80, take=0.60,
    aov=800, cust_mult=1.0, small_share=0.70, large_share=0.05,
    fee=0.01, fmin=99, fcap=3000, haircut=0.70,
    guard=0.06, guard_price=1.0, guard_months=0.80,
    pm=12, pm_cost=squad_cost(31.5, 0.20)[0], compute=20, mk_share=0.0, llm="Sonnet",
    err_p=0.002, err_cost=25000, cont=0.20, build_pm=26.4,
)
RANGES = dict(
    onboarded=(5e6, 12e6), active=(0.05, 0.20), webhook_share=(0.20, 0.60), connected=(0.03, 0.15),
    rate_sm=(0.15, 1.0), elig=(0.4, 0.9), recall=(0.5, 0.95), take=(0.3, 0.9), aov=(300, 1500),
    cust_mult=(0.5, 1.5), small_share=(0.85, 0.60), fee=(0.005, 0.02), haircut=(0.5, 0.9),
    guard=(0.02, 0.12), guard_price=(0.5, 1.5), guard_months=(0.5, 0.9), pm=(6, 24),
    pm_cost=(squad_cost(25, 0.10)[0], squad_cost(38, 0.40)[0]), compute=(5, 100), mk_share=(0.0, 0.5),
    err_p=(0.0005, 0.01), cont=(0.1, 0.4),
)
SCENARIOS = {
    "Cautious": dict(connected=0.04, guard=0.05, guard_months=0.70),
    "Base": {},
    "Stretch": dict(connected=0.12, guard=0.08, guard_months=0.85),
    "Downside": dict(connected=0.03, guard=0.02),
}


def conversation_cost(model):
    inp, cached, out = LLM[model]
    return FX * 5 * (2000 * inp + 2000 * cached + 200 * out) / 1e6  # 5 calls, 4k tokens in, 200 out


def cohort(p):
    return p["onboarded"] * p["active"] * p["webhook_share"]


def detected(p):
    """Incidents a year that Watch detects across the whole cohort (the base for indirect benefits)."""
    mid = 1 - p["small_share"] - p["large_share"]
    return cohort(p) * ((p["small_share"] + mid) * p["rate_sm"] + p["large_share"] * p["rate_lg"]) * p["recall"]


def model(p, ramp=1.0):
    connected = cohort(p) * p["connected"]
    mid = 1 - p["small_share"] - p["large_share"]
    segments = {"small": (p["small_share"], p["rate_sm"]), "mid": (mid, p["rate_sm"]), "large": (p["large_share"], p["rate_lg"])}
    msg = (1 - p["mk_share"]) * WA_UTILITY + p["mk_share"] * WA_MARKETING
    fees = var = restored = fixes = 0.0
    for name, (share, rate) in segments.items():
        customers = CUSTOMERS[name] * p["cust_mult"]
        incidents = connected * share * rate * p["elig"] * p["recall"]
        guard_share = p["guard"] if name != "small" else 0.0  # Guard merchants pay no per-incident fee
        paid = incidents * (1 - guard_share) * p["take"]
        done = paid + incidents * guard_share
        value = customers * p["aov"]
        fees += paid * min(p["fcap"], max(p["fmin"], p["fee"] * value)) * p["haircut"]
        complaints = customers * 0.2
        var += done * ((customers * 2 + complaints * 4) * msg + complaints * (conversation_cost(p["llm"]) + 0.2))
        restored += done * value
        fixes += done
    guard_n = connected * (mid + p["large_share"]) * p["guard"]
    guard_rev = guard_n * (0.83 * 999 + 0.17 * 2999) * p["guard_price"] * 12 * p["guard_months"]
    err = fixes * p["err_p"] * p["err_cost"]
    people = p["pm"] * p["pm_cost"] * 1e5
    cost = (people + p["compute"] * 1e5 + var + err) * (1 + p["cont"])
    revenue = (fees + guard_rev) * ramp
    return dict(connected=connected, fixes=fixes, fees=fees * ramp, guard=guard_rev * ramp, guard_n=guard_n,
                revenue=revenue, cost=cost, net=revenue - cost, restored=restored * ramp, var=var, err=err, people=people)


def three_year(p, indirect=0.0):
    total, years = 0.0, []
    for i, ramp in enumerate(RAMP):
        m = model(p, ramp)
        if i == 0:
            cost = (p["build_pm"] * p["pm_cost"] * 1e5 + p["compute"] * 1e5 * 0.5 + (m["var"] + m["err"]) * ramp) * (1 + p["cont"])
        else:
            cost = (m["people"] + p["compute"] * 1e5 + (m["var"] + m["err"]) * ramp) * (1 + p["cont"])
        net = m["revenue"] - cost + indirect * detected(p) * ramp
        years.append(net)
        total += net
    return total, years


def cr(x):
    return x / 1e7


def with_(**kw):
    p = dict(BASE)
    p.update(kw)
    return p


def solve(key, lo, hi, **kw):
    for _ in range(50):
        mid = (lo + hi) / 2
        if model(with_(**{key: mid}, **kw))["net"] > 0:
            hi = mid
        else:
            lo = mid
    return hi


def monte_carlo(indirect, draws=20000, seed=1011):
    rnd = random.Random(seed)
    steady_pos = cum_pos = 0
    cums, steadies = [], []
    for _ in range(draws):
        p = dict(BASE)
        for k, (lo, hi) in RANGES.items():
            p[k] = rnd.triangular(min(lo, hi), max(lo, hi), BASE[k])
        p["rate_lg"] = p["rate_sm"] / 2
        p["build_pm"] = rnd.triangular(15, 50, 26.4)
        steady = model(p)["net"] + indirect * detected(p)
        cum = three_year(p, indirect)[0]
        steady_pos += steady > 0
        cum_pos += cum > 0
        steadies.append(steady)
        cums.append(cum)
    steadies.sort()
    cums.sort()
    return steady_pos / draws, cum_pos / draws, cr(steadies[draws // 2]), cr(cums[draws // 10]), cr(cums[draws // 2]), cr(cums[draws * 9 // 10])


def report():
    base = model(BASE)
    print("== Squad cost (lakh per person-month, lakh per year) ==")
    for name, (cash, esop) in {"low": (25, 0.10), "mid": (31.5, 0.20), "high": (38, 0.40)}.items():
        pm, annual = squad_cost(cash, esop)
        print(f"{name}: cash {cash}L, ESOP {esop:.0%}: {pm:.2f} per person-month, {annual:.0f} per year")
    print("\n== Cohort and incidents (base) ==")
    print(f"cohort {cohort(BASE):,.0f}; connected {base['connected']:,.0f}; detected incidents a year {detected(BASE):,.0f}; "
          f"fixes done {base['fixes']:,.0f}")
    print("\n== Base steady state (Rs crore) ==")
    for k in ("fees", "guard", "revenue", "cost", "net", "people", "restored"):
        print(f"{k}: {cr(base[k]):.2f}")
    print(f"Guard merchants: {base['guard_n']:.0f}; year-1 build cost incl. contingency: "
          f"{cr(BASE['build_pm'] * BASE['pm_cost'] * 1e5 * (1 + BASE['cont'])):.2f}")
    print(f"fees as % of value restored: {100 * base['fees'] / base['restored']:.2f}; all direct revenue: "
          f"{100 * base['revenue'] / base['restored']:.2f}")
    print("\n== Years and indirect benefit (Rs per detected incident) ==")
    for ind in (0, 50, 100, 150):
        total, years = three_year(BASE, ind)
        print(f"indirect {ind}: steady {cr(base['net'] + ind * detected(BASE)):.2f}; three-year {cr(total):.2f}; "
              f"years {[round(cr(y), 2) for y in years]}")
    print("\n== Scenarios: steady, three-year, then with Rs50 indirect (steady, three-year), cost ==")
    for name, kw in SCENARIOS.items():
        p = with_(**kw)
        m = model(p)
        t0, _ = three_year(p)
        t50, _ = three_year(p, 50)
        print(f"{name}: {cr(m['net']):.2f}, {cr(t0):.2f}; {cr(m['net'] + 50 * detected(p)):.2f}, {cr(t50):.2f}; cost {cr(m['cost']):.2f}")
    print("\n== Pay cases: steady, three-year, with Rs50 (steady, three-year) ==")
    for name, (cash, esop) in {"low": (25, 0.10), "mid": (31.5, 0.20), "high": (38, 0.40)}.items():
        p = with_(pm_cost=squad_cost(cash, esop)[0])
        m = model(p)
        print(f"{name}: {cr(m['net']):.2f}, {cr(three_year(p)[0]):.2f}; {cr(m['net'] + 50 * detected(p)):.2f}, {cr(three_year(p, 50)[0]):.2f}")
    print("\n== Break-evens (steady, direct only) ==")
    c, g = solve("connected", 0.005, 0.5), solve("guard", 0, 1)
    print(f"connected {100 * c:.1f}% = {c * cohort(BASE):,.0f} merchants; Guard uptake {100 * g:.1f}%")
    print(f"without Guard: net {cr(model(with_(guard=0))['net']):.2f}; connected needed {100 * solve('connected', 0.005, 0.9, guard=0):.0f}%")
    print(f"indirect needed per detected incident with no Guard: Rs {-model(with_(guard=0))['net'] / detected(BASE):.0f}")
    print("\n== Fix price variants: fees, steady net ==")
    variants = {"1%, min 99, cap 3000 (base)": {}, "cap 5000": dict(fcap=5000), "0.5%": dict(fee=0.005), "2%": dict(fee=0.02),
                "free": dict(fee=0, fmin=0), "free first 2 incidents": dict(haircut=0.3)}
    for name, kw in variants.items():
        m = model(with_(**kw))
        print(f"{name}: {cr(m['fees']):.2f}, {cr(m['net']):.2f}")
    print("\n== Guard price x demand sensitivity: revenue index (price x0.5, 0.75, 1, 1.5, 2) ==")
    for eps in (0.5, 1.0, 1.5):
        row = [model(with_(guard_price=m_, guard=BASE["guard"] * m_ ** -eps))["guard"] / base["guard"] for m_ in (0.5, 0.75, 1, 1.5, 2)]
        print(f"elasticity {eps}: " + ", ".join(f"{x:.2f}" for x in row))
    print("\n== Fix fee x demand sensitivity: fee revenue index (fee 0.5%, 1%, 2%, 3%, 5%) ==")
    ref = model(with_(guard=0))["fees"]
    for eps in (0.5, 1.0, 1.5):
        row = [model(with_(guard=0, fee=f, take=min(1, BASE["take"] * (0.01 / f) ** eps)))["fees"] / ref for f in (0.005, 0.01, 0.02, 0.03, 0.05)]
        print(f"elasticity {eps}: " + ", ".join(f"{x:.2f}" for x in row))
    print("\n== Tornado: steady net at low and high value of each input (Rs crore) ==")
    rows = []
    for k, (lo, hi) in RANGES.items():
        a, b = cr(model(with_(**{k: lo}))["net"]), cr(model(with_(**{k: hi}))["net"])
        rows.append((abs(b - a), k, lo, a, hi, b))
    for _, k, lo, a, hi, b in sorted(rows, reverse=True):
        print(f"{k}: {lo:g} -> {a:.2f}; {hi:g} -> {b:.2f}")
    print("\n== LLM tier: steady net ==")
    for tier in LLM:
        print(f"{tier}: {cr(model(with_(llm=tier))['net']):.2f}")
    print("\n== Monte Carlo (20,000 draws, triangular around base) ==")
    for ind in (0, 50, 100, 150):
        sp, cp, med_s, p10, p50, p90 = monte_carlo(ind)
        print(f"indirect {ind}: P(steady>0) {sp:.0%}; P(3yr>0) {cp:.0%}; median steady {med_s:.2f}; 3yr P10 {p10:.2f}, P50 {p50:.2f}, P90 {p90:.2f}")
    print("\n== A merchant's view, per year at base (rupees) ==")
    for name, rate in (("small", BASE["rate_sm"]), ("mid", BASE["rate_sm"]), ("large", BASE["rate_lg"])):
        customers = CUSTOMERS[name]
        value = customers * BASE["aov"]
        incidents = rate * BASE["elig"] * BASE["recall"]
        fee = min(BASE["fcap"], max(BASE["fmin"], BASE["fee"] * value))
        guard = {"small": 0, "mid": 999 * 12, "large": 2999 * 12}[name]
        restored = incidents * value
        print(f"{name}: incident value {value:,}; fee per incident {fee:,.0f}; expected incidents {incidents:.2f}; expected fee "
              f"{incidents * fee:,.0f}; expected restored {restored:,.0f}; Guard {guard:,} = {guard / restored:.0%} of restored")


if __name__ == "__main__":
    report()
