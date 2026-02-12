from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Mapping, Sequence


POSITIONS = ("QB", "RB", "WR", "TE")
POSITION_INDEX = {name: idx for idx, name in enumerate(POSITIONS)}


@dataclass(frozen=True)
class ProjectionSpec:
    """Sparse projection anchors (round -> players already taken for a position)."""

    anchors: Mapping[int, int]


class ProjectionBuilder:
    """
    Build smooth, monotonic per-round projections from sparse input anchors.

    This improves the input side compared to hard-coding every round manually.
    You only define a few trusted points (e.g. rounds 1, 4, 8, 13), and this
    class interpolates the full round-by-round projection while enforcing
    monotonic growth.
    """

    def __init__(self, rounds: int, max_player_rank: int):
        self.rounds = rounds
        self.max_player_rank = max_player_rank

    def build(self, spec: ProjectionSpec) -> List[int]:
        if not spec.anchors:
            raise ValueError("Projection anchors cannot be empty.")

        anchors = {int(r): int(v) for r, v in spec.anchors.items()}
        if 1 not in anchors:
            raise ValueError("Projection anchors must include round 1.")

        if self.rounds not in anchors:
            anchors[self.rounds] = max(anchors.values())

        rounds = sorted(anchors)
        if rounds[0] < 1 or rounds[-1] > self.rounds:
            raise ValueError("Projection anchors contain rounds outside valid range.")

        out = [0] * self.rounds
        for i in range(len(rounds) - 1):
            start_r, end_r = rounds[i], rounds[i + 1]
            start_v = anchors[start_r]
            end_v = anchors[end_r]
            span = end_r - start_r
            for r in range(start_r, end_r + 1):
                t = 0 if span == 0 else (r - start_r) / span
                out[r - 1] = round(start_v + t * (end_v - start_v))

        # Enforce monotonicity and valid rank boundaries.
        for i in range(1, len(out)):
            out[i] = max(out[i], out[i - 1])
        out = [min(max(v, 1), self.max_player_rank) for v in out]
        return out


def load_projection_tables(path: Path) -> Dict[str, object]:
    import pandas as pd

    sheets = pd.read_excel(path, sheet_name=list(POSITIONS))
    return {pos: sheets[pos].iloc[:, 1:3].reset_index(drop=True) for pos in POSITIONS}


def build_point_matrix(
    player_tables: Mapping[str, object],
    projections: Mapping[str, Sequence[int]],
    rounds: int,
) -> List[List[float]]:
    matrix: List[List[float]] = []
    for pos in POSITIONS:
        pos_points: List[float] = []
        table = player_tables[pos]
        for r in range(rounds):
            rank = projections[pos][r]
            row = min(rank - 1, len(table) - 1)
            pos_points.append(float(table.iloc[row, 0]))
        matrix.append(pos_points)
    return matrix


def optimize_draft(
    points: Sequence[Sequence[float]],
    rounds: int = 13,
    position_target: Sequence[int] = (2, 3, 3, 2, 7),
):
    import pulp
    p_count = len(POSITIONS)
    no_games = 17
    injury_games = [14.9, 13.2, 14.0, 14.2]
    replacement = [14.0, 7.7, 7.0, 4.5]
    no_replace = 1

    model = pulp.LpProblem("FantasyDraft2025_v2", pulp.LpMaximize)
    pick = pulp.LpVariable.dicts("Pick", (range(p_count), range(rounds)), cat="Binary")
    pick_bench = pulp.LpVariable.dicts("PickBench", (range(p_count), range(rounds)), cat="Binary")
    rep_val = pulp.LpVariable.dicts("RepVal", (range(p_count), range(rounds)), lowBound=0)

    model += pulp.lpSum(
        pick[p][r] * (points[p][r] * injury_games[p] / 16 + no_replace * replacement[p])
        + (no_games - injury_games[p] - no_replace) * rep_val[p][r]
        for p in range(p_count)
        for r in range(rounds)
    )

    model += pulp.lpSum(pick[0][r] for r in range(rounds)) == position_target[0]
    model += pulp.lpSum(pick[1][r] for r in range(rounds)) >= position_target[1]
    model += pulp.lpSum(pick[2][r] for r in range(rounds)) >= position_target[2]
    model += pulp.lpSum(pick[p][r] for r in range(rounds) for p in (1, 2)) <= position_target[4]
    model += pulp.lpSum(pick[3][r] for r in range(rounds)) == position_target[3]

    for p in range(p_count):
        for r in range(rounds):
            model += rep_val[p][r] <= replacement[p] * pick[p][r] * 1000
            model += rep_val[p][r] <= (
                pulp.lpSum(
                    pick_bench[p][r2]
                    * (
                        points[p][r2] / 16 * (injury_games[p] / 16)
                        + replacement[p] * (1 - injury_games[p] / 16)
                    )
                    for r2 in range(rounds)
                )
                + (1 - pulp.lpSum(pick_bench[p][r2] for r2 in range(rounds))) * replacement[p]
            )

    forced = [(0, 0), (1, 1), (1, 2), (1, 3), (3, 4), (1, 5), (2, 6)]
    for p, r in forced:
        model += pick[p][r] == 1

    for r in range(rounds):
        model += pulp.lpSum(pick[p][r] + pick_bench[p][r] for p in range(p_count)) == 1

    for p in range(p_count):
        model += pulp.lpSum(pick_bench[p][r] for r in range(rounds)) <= 1

    model.solve(pulp.PULP_CBC_CMD(msg=False))
    return model


def main() -> None:
    import pulp

    rounds = 13
    projections_path = Path("projections.xlsx")

    # Improved input style: sparse anchors per position instead of full hard-coded vectors.
    anchor_specs = {
        "QB": ProjectionSpec({1: 2, 4: 9, 7: 12, 10: 20, 13: 21}),
        "RB": ProjectionSpec({1: 1, 4: 12, 7: 20, 10: 25, 13: 31}),
        "WR": ProjectionSpec({1: 1, 4: 9, 7: 16, 10: 28, 13: 36}),
        "TE": ProjectionSpec({1: 1, 4: 4, 7: 5, 10: 9, 13: 13}),
    }

    tables = load_projection_tables(projections_path)
    max_rank = max(len(df) for df in tables.values())
    builder = ProjectionBuilder(rounds=rounds, max_player_rank=max_rank)

    projections = {pos: builder.build(anchor_specs[pos]) for pos in POSITIONS}
    points = build_point_matrix(tables, projections, rounds)
    model = optimize_draft(points=points, rounds=rounds)

    print(f"Objective value: {pulp.value(model.objective):.2f}")
    for pos in POSITIONS:
        print(f"{pos} projection by round: {projections[pos]}")


if __name__ == "__main__":
    main()
