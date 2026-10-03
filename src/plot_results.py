"""Graph every result collected so far in experiment_data/.

Usage:
    python src/plot_results.py

Writes to graphs/:
    summary.csv                               the numbers behind every chart
    compare_models/chunk_size_lines.png       line graph: chunk size vs result,
                                              one line per model
    compare_models/<mode>/age_lines.png       line graph: age vs result, one
                                              line per model
    compare_models/<mode>/base_persona.png    every model's result for the
                                              base persona
    compare_models/<mode>/no_persona_vs_base.png  each model's default (no
                                              persona) next to the base persona
    compare_models/<mode>/shift_by_<attr>.png how much changing one attribute
                                              shifts each model's result
    per_model/<model>/mode_comparison.png     does chunk size matter?
    per_model/<model>/by_<attr>.png           one attribute, three chunk sizes

Charts only appear once there is data for them, so run this as often as you
like. Folders starting with "_" in experiment_data/ (e.g. _old_prompt) are
ignored.
"""
import shutil
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

from personality_lab import load_models, load_persona_config, project_file_location

PROJECT_DIR = Path(__file__).resolve().parent.parent  # src/ is one level down
GRAPHS_DIR = PROJECT_DIR / "graphs"

# Mode order and colours: the first three slots of a colourblind-checked
# categorical palette. Keep them fixed so a mode is the same colour everywhere.
MODES = {
    "one_by_one": ("One by one", "#2a78d6"),
    "chunks_of_5": ("Chunks of 5", "#eb6834"),
    "one_shot": ("One shot", "#1baf7a"),
}
DIMENSIONS = {
    "percentage_EI_E": "Extraverted (E) vs Introverted (I)",
    "percentage_SN_S": "Observant (S) vs Intuitive (N)",
    "percentage_TF_T": "Thinking (T) vs Feeling (F)",
    "percentage_JP_J": "Judging (J) vs Prospecting (P)",
    "percentage_AT_A": "Assertive (A) vs Turbulent (T)",
}
SINGLE_SERIES = "#2a78d6"
# One colour and marker per model, in models.json order (colourblind-checked
# as adjacent pairs for line charts). Models past the 7th share grey.
MODEL_COLOURS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4",
                 "#008300", "#4a3aa7"]
MODEL_MARKERS = ["o", "s", "^", "D", "v", "P", "X"]
EXTRA_MODEL_COLOUR = "#8a8985"
# Chunk sizes as an ordered axis for line graphs: questions per API call.
CHUNK_AXIS = {"one_by_one": "1", "chunks_of_5": "5", "one_shot": "All 60"}
TEXT_PRIMARY = "#0b0b0b"
TEXT_SECONDARY = "#52514e"
GRID = "#e6e5e1"
# Diverging: red = shifted towards the second letter, blue = towards the first.
SHIFT_CMAP = LinearSegmentedColormap.from_list(
    "shift", ["#b8302f", "#e34948", "#f0efec", "#3987e5", "#1c5cab"]
)
SHIFT_LIMIT = 30  # Percentage points at which the colour saturates.

plt.rcParams.update({
    "font.size": 10,
    "text.color": TEXT_PRIMARY,
    "axes.labelcolor": TEXT_SECONDARY,
    "axes.edgecolor": GRID,
    "xtick.color": TEXT_SECONDARY,
    "ytick.color": TEXT_SECONDARY,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
    "savefig.dpi": 150,
})


# ─────────────── Loading and summarising ───────────────

def load_results(config):
    """Read experiment_data/<model>/<mode>/<persona>/*.csv into one table."""
    frames = []
    for csv_path in sorted(project_file_location.glob("*/*/*/*.csv")):
        model, mode = csv_path.relative_to(project_file_location).parts[:2]
        if model.startswith("_") or mode not in MODES:
            continue
        df = pd.read_csv(csv_path)
        df["model"] = model
        df["experiment_mode"] = mode
        frames.append(df)
    if not frames:
        raise SystemExit(f"No results found in {project_file_location}")
    df = pd.concat(frames, ignore_index=True)
    # Whole-number columns with gaps (the no-persona control has no age) would
    # otherwise become decimals (40.0); keep them as whole numbers.
    for column in df.columns:
        if (column.startswith("persona_") and pd.api.types.is_float_dtype(df[column])
                and (df[column].dropna() % 1 == 0).all()):
            df[column] = df[column].astype("Int64")

    # Work out which single attribute each row differs from the base persona
    # in, from the attribute values themselves (so renamed personas still fit).
    base = config["base"]
    def varied_attribute(row):
        if row["persona_name"] == "no_persona":
            return "none"
        differing = [
            attribute for attribute, value in base.items()
            if as_text(row[f"persona_{attribute}"]) != as_text(value)
        ]
        if not differing:
            return "base"
        return differing[0] if len(differing) == 1 else None

    df["varied_attribute"] = df.apply(varied_attribute, axis=1)
    return df[df["varied_attribute"].notna()]


# Two-sided 95% critical values of Student's t, by degrees of freedom (n - 1).
# With only a handful of repetitions the usual 1.96 makes intervals too narrow.
T_CRITICAL_95 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
                 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086,
                 30: 2.042}


def t_critical(degrees_of_freedom):
    """Critical t value; for df between table entries, use the next lower
    entry (slightly wider, i.e. cautious). Large samples use 1.96."""
    if degrees_of_freedom > 30:
        return 1.96
    return T_CRITICAL_95[max(k for k in T_CRITICAL_95 if k <= degrees_of_freedom)]


def summarise(values):
    """Mean and the half-width of its 95% confidence interval."""
    n = len(values)
    mean = values.mean()
    ci = t_critical(n - 1) * values.std(ddof=1) / np.sqrt(n) if n > 1 else 0.0
    return mean, ci, n


def as_text(value):
    """Compare persona values as text, treating 40 and 40.0 as the same
    (pandas turns whole numbers into decimals when a column has gaps, e.g.
    the no-persona control has no age)."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def rows_with_value(df, attribute, value):
    return df[df[f"persona_{attribute}"].map(as_text) == as_text(value)]


def ordered_present(order, present):
    present = set(present)
    return [item for item in order if item in present]


# ─────────────── Shared drawing helpers ───────────────

def style_axis(ax, title, horizontal=False):
    """A 0-100 axis for one dimension, labelled with its two traits.

    The data is "% of the first-named trait" (e.g. % Extraverted). The axis
    puts each trait on the side where it is named: horizontally, the first
    trait is on the LEFT (so "Extraverted vs Introverted" reads left to
    right); vertically, the first trait is at the TOP.
    """
    first, second = [part.split(" (")[0] for part in title.split(" vs ")]
    ticks = [0, 25, 50, 75, 100]
    tick_labels = ["100%", "75%", "50/50", "75%", "100%"]
    reference = dict(color=TEXT_SECONDARY, linewidth=1, linestyle=(0, (4, 3)))
    if horizontal:
        ax.set_xlim(100, 0)  # Reversed: 100% of the first trait on the left.
        ax.set_xticks(ticks, tick_labels)
        ax.axvline(50, **reference)
        ax.set_title(f"← {first}", loc="left", fontsize=10, color=TEXT_PRIMARY)
        ax.set_title(f"{second} →", loc="right", fontsize=10, color=TEXT_PRIMARY)
    else:
        ax.set_ylim(0, 100)
        ax.set_yticks(ticks, tick_labels)
        ax.axhline(50, **reference)
        ax.set_title(f"{first} vs {second}", loc="left", fontsize=10,
                     color=TEXT_PRIMARY)
        for y, va, label in ((0.98, "top", f"▲ {first}"),
                             (0.02, "bottom", f"▼ {second}")):
            ax.text(0.01, y, label, transform=ax.transAxes, va=va,
                    fontsize=8.5, color=TEXT_SECONDARY)
    ax.grid(axis="x" if horizontal else "y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)


def draw_strip(ax, position, values, colour, rng, horizontal=False):
    """Each repetition as a faint dot, plus the mean and 95% CI on top."""
    jitter = position + rng.uniform(-0.12, 0.12, len(values))
    mean, ci, _ = summarise(values)
    if horizontal:
        ax.scatter(values, jitter, s=14, color=colour, alpha=0.35, linewidths=0)
        ax.errorbar(mean, position, xerr=ci, fmt="o", color=colour,
                    markersize=7, elinewidth=2, capsize=0,
                    markeredgecolor="white", markeredgewidth=1.5)
    else:
        ax.scatter(jitter, values, s=14, color=colour, alpha=0.35, linewidths=0)
        ax.errorbar(position, mean, yerr=ci, fmt="o", color=colour,
                    markersize=7, elinewidth=2, capsize=0,
                    markeredgecolor="white", markeredgewidth=1.5)


def add_titles(fig, title, subtitle, top=0.995, gap=0.033):
    fig.suptitle(title, x=0.01, y=top, ha="left", fontsize=13)
    fig.text(0.01, top - gap, subtitle, color=TEXT_SECONDARY, va="top")


def save(fig, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved {path.relative_to(PROJECT_DIR)}")


# ─────────────── Comparing models ───────────────

def plot_base_persona_by_model(df, mode, models, rng):
    """Every model's result for the base persona, one mode."""
    rows = df[(df["experiment_mode"] == mode) & (df["varied_attribute"] == "base")]
    present = ordered_present(models, rows["model"])
    if not present:
        return

    fig, axes = plt.subplots(1, len(DIMENSIONS), sharey=True,
                             figsize=(16, 1.6 + 0.45 * len(present)))
    for ax, (column, title) in zip(axes, DIMENSIONS.items()):
        for y, model in enumerate(present):
            values = rows.loc[rows["model"] == model, column]
            draw_strip(ax, y, values, SINGLE_SERIES, rng, horizontal=True)
        style_axis(ax, title, horizontal=True)
    axes[0].set_yticks(range(len(present)), present)
    axes[0].set_ylim(len(present) - 0.5, -0.5)  # First model at the top.
    fig.supxlabel("How strongly the model leans to each trait (50/50 = no lean)",
                  color=TEXT_SECONDARY, fontsize=10)
    add_titles(fig, f"Base persona, every model ({MODES[mode][0].lower()})",
               "Faint dots: repetitions. Solid dot and bar: mean with 95% "
               "confidence interval. Dashed line: 50% (no lean).",
               gap=0.06 + 0.4 / len(present))
    fig.tight_layout(rect=(0, 0, 1, 0.86 - 0.3 / len(present)))
    save(fig, GRAPHS_DIR / "compare_models" / mode / "base_persona.png")


def plot_persona_vs_default(df, mode, models, rng):
    """Each model with no persona (its own default) next to the base persona:
    how far does the persona move the model away from its default?"""
    rows = df[df["experiment_mode"] == mode]
    groups = {
        "No persona (model's default)": ("none", "#eb6834", 0.18),
        "Base persona": ("base", "#2a78d6", -0.18),
    }
    present = ordered_present(models, rows.loc[rows["varied_attribute"] == "none", "model"])
    present = [m for m in present
               if not rows[(rows["model"] == m) & (rows["varied_attribute"] == "base")].empty]
    if not present:
        return

    fig, axes = plt.subplots(1, len(DIMENSIONS), sharey=True,
                             figsize=(16, 1.8 + 0.6 * len(present)))
    for ax, (column, title) in zip(axes, DIMENSIONS.items()):
        for y, model in enumerate(present):
            for attribute, colour, offset in groups.values():
                values = rows.loc[(rows["model"] == model)
                                  & (rows["varied_attribute"] == attribute), column]
                draw_strip(ax, y + offset, values, colour, rng, horizontal=True)
        style_axis(ax, title, horizontal=True)
    axes[0].set_yticks(range(len(present)), present)
    axes[0].set_ylim(len(present) - 0.5, -0.5)  # First model at the top.
    fig.supxlabel("How strongly the model leans to each trait (50/50 = no lean)",
                  color=TEXT_SECONDARY, fontsize=10)
    add_titles(fig, f"No persona vs base persona ({MODES[mode][0].lower()})",
               "Orange: no system prompt, the model's own default. Blue: "
               "the base persona. The gap is how far the persona moves the "
               "model.\nFaint dots: repetitions. Solid dot and bar: mean "
               "with 95% confidence interval.",
               gap=0.05 + 0.3 / len(present))
    handles = [plt.Line2D([], [], marker="o", linestyle="", markersize=7,
                          color=colour, label=label)
               for label, (_, colour, _) in groups.items()]
    fig.legend(handles=handles, loc="upper right", ncol=2, frameon=False,
               bbox_to_anchor=(0.995, 0.995))
    fig.tight_layout(rect=(0, 0, 1, 0.84 - 0.3 / len(present)))
    save(fig, GRAPHS_DIR / "compare_models" / mode / "no_persona_vs_base.png")


def plot_shift_heatmap(df, mode, models, attribute, values, base_value):
    """How far each value of one attribute moves each model away from the
    base persona, in percentage points, for every dimension."""
    rows = df[df["experiment_mode"] == mode]
    variants = [value for value in values if str(value) != str(base_value)]
    present = ordered_present(models, rows.loc[
        rows["varied_attribute"] == attribute, "model"])
    if not present:
        return

    fig, axes = plt.subplots(
        len(DIMENSIONS), 1, sharex=True,
        figsize=(2.6 + 1.05 * len(present), 1.6 + len(DIMENSIONS) * (0.42 * len(variants) + 0.55)),
    )
    for ax, (column, title) in zip(axes, DIMENSIONS.items()):
        shifts = np.full((len(variants), len(present)), np.nan)
        clear = np.zeros_like(shifts, dtype=bool)
        for j, model in enumerate(present):
            model_rows = rows[rows["model"] == model]
            base_rows = model_rows[model_rows["varied_attribute"] == "base"]
            if base_rows.empty:
                continue
            base_mean, base_ci, _ = summarise(base_rows[column])
            for i, value in enumerate(variants):
                cell = rows_with_value(
                    model_rows[model_rows["varied_attribute"] == attribute],
                    attribute, value)
                if cell.empty:
                    continue
                mean, ci, _ = summarise(cell[column])
                shifts[i, j] = mean - base_mean
                # Larger than the combined uncertainty of the two means (a
                # slightly cautious test of whether the shift is real).
                clear[i, j] = abs(shifts[i, j]) > np.hypot(ci, base_ci)

        ax.imshow(shifts, cmap=SHIFT_CMAP, vmin=-SHIFT_LIMIT, vmax=SHIFT_LIMIT,
                  aspect="auto")
        for i in range(len(variants)):
            for j in range(len(present)):
                shift = shifts[i, j]
                if np.isnan(shift):
                    ax.text(j, i, "–", ha="center", va="center",
                            color=TEXT_SECONDARY)
                    continue
                strong = abs(shift) > SHIFT_LIMIT * 0.55
                ax.text(j, i, f"{shift:+.0f}", ha="center", va="center",
                        fontweight="bold" if clear[i, j] else "normal",
                        color="white" if strong else TEXT_PRIMARY)
        ax.set_title(title, loc="left", fontsize=10, color=TEXT_PRIMARY)
        ax.set_yticks(range(len(variants)), [str(v) for v in variants])
        ax.set_xticks(np.arange(len(present) + 1) - 0.5, minor=True)
        ax.set_yticks(np.arange(len(variants) + 1) - 0.5, minor=True)
        ax.grid(which="minor", color="white", linewidth=2)
        ax.tick_params(which="both", length=0)
        for spine in ax.spines.values():
            spine.set_visible(False)
    axes[-1].set_xticks(range(len(present)), present, rotation=30, ha="right")

    add_titles(
        fig,
        f"How {attribute} shifts each model ({MODES[mode][0].lower()})",
        f"Change from the base persona ({base_value}), in percentage points "
        "(rows: personas, columns: models).\nBlue: shifted towards the "
        "first-named trait (e.g. more Extraverted). Red: towards the second "
        "(e.g. more Introverted).\n"
        "Bold: larger than the 95% CI. –: not run yet.",
        gap=0.012 + 0.3 / fig.get_figheight(),
    )
    fig.tight_layout(rect=(0, 0, 1, 1 - 1.15 / fig.get_figheight()))
    save(fig, GRAPHS_DIR / "compare_models" / mode / f"shift_by_{attribute}.png")


# ─────────────── One model at a time ───────────────

def plot_mode_comparison(df, model, rng):
    rows = df[(df["model"] == model) & (df["varied_attribute"] == "base")]
    modes = ordered_present(MODES, rows["experiment_mode"])
    if not modes:
        return

    fig, axes = plt.subplots(1, len(DIMENSIONS), figsize=(15, 4.2), sharey=True)
    for ax, (column, title) in zip(axes, DIMENSIONS.items()):
        for x, mode in enumerate(modes):
            values = rows.loc[rows["experiment_mode"] == mode, column]
            draw_strip(ax, x, values, MODES[mode][1], rng)
        style_axis(ax, title)
        ax.set_xticks(range(len(modes)), [MODES[m][0] for m in modes])
        ax.set_xlim(-0.6, len(modes) - 0.4)
    axes[0].set_ylabel("Lean (50/50 = no lean)")
    add_titles(fig, f"{model}: does chunk size change the base persona's result?",
               "Faint dots: repetitions. Solid dot and bar: mean with 95% "
               "confidence interval. Dashed line: 50% (no lean).", gap=0.1)
    fig.tight_layout(rect=(0, 0, 1, 0.86))
    save(fig, GRAPHS_DIR / "per_model" / model / "mode_comparison.png")


def plot_attribute_by_mode(df, model, attribute, values, base_value):
    # The base persona is also the base_value point on every attribute chart.
    rows = df[(df["model"] == model)
              & df["varied_attribute"].isin([attribute, "base"])]
    if attribute not in set(rows["varied_attribute"]):
        return
    modes = ordered_present(MODES, rows["experiment_mode"])
    numeric = all(isinstance(v, (int, float)) for v in values)
    labels = [str(v) for v in values]
    offsets = np.linspace(-0.22, 0.22, len(modes)) if len(modes) > 1 else [0]

    fig, axes = plt.subplots(len(DIMENSIONS), 1, sharex=True,
                             figsize=(max(7, 1.1 * len(values) + 3), 11))
    for ax, (column, title) in zip(axes, DIMENSIONS.items()):
        for offset, mode in zip(offsets, modes):
            xs, means, cis = [], [], []
            for x, value in enumerate(values):
                cell = rows_with_value(
                    rows[rows["experiment_mode"] == mode], attribute, value)
                if cell.empty:
                    continue
                mean, ci, _ = summarise(cell[column])
                xs.append(x + offset)
                means.append(mean)
                cis.append(ci)
            colour = MODES[mode][1]
            if numeric and len(xs) > 1:
                ax.plot(xs, means, color=colour, linewidth=2, alpha=0.6)
            ax.errorbar(xs, means, yerr=cis, fmt="o", color=colour,
                        markersize=7, elinewidth=2, capsize=0,
                        markeredgecolor="white", markeredgewidth=1.5)
        style_axis(ax, title)
    axes[-1].set_xticks(range(len(values)), [
        f"{label}\n(base)" if str(value) == str(base_value) else label
        for label, value in zip(labels, values)
    ])
    if not numeric and max(len(label) for label in labels) > 10:
        axes[-1].tick_params(axis="x", labelrotation=30)
        for tick in axes[-1].get_xticklabels():
            tick.set_ha("right")
    axes[-1].set_xlabel(attribute.capitalize())
    fig.supylabel("Lean (50/50 = no lean)", color=TEXT_SECONDARY,
                  fontsize=10)

    add_titles(fig, f"{model}: how {attribute} shifts the result",
               "Mean with 95% confidence interval; every other attribute held "
               "at the base persona.")
    handles = [
        plt.Line2D([], [], marker="o", linestyle="", markersize=7,
                   color=MODES[mode][1], label=MODES[mode][0])
        for mode in modes
    ]
    fig.legend(handles=handles, loc="upper left", ncol=len(handles),
               frameon=False, bbox_to_anchor=(0.005, 0.958))
    fig.tight_layout(rect=(0, 0, 1, 0.925))
    save(fig, GRAPHS_DIR / "per_model" / model / f"by_{attribute}.png")


# ─────────────── Line graphs (ordered x-axis only) ───────────────

def model_style(models, model):
    index = models.index(model)
    if index < len(MODEL_COLOURS):
        return MODEL_COLOURS[index], MODEL_MARKERS[index]
    return EXTRA_MODEL_COLOUR, "o"


def plot_model_lines(models, x_labels, cell_rows, title, subtitle, x_label, path):
    """One panel per dimension; one line per model across an ordered x-axis.

    cell_rows(model, x_index) returns the result rows for that point.
    Models with fewer than two points are left out (a line needs two).
    """
    lines = {}
    for model in models:
        points = []
        for x in range(len(x_labels)):
            rows = cell_rows(model, x)
            if not rows.empty:
                points.append((x, rows))
        if len(points) >= 2:
            lines[model] = points
    if not lines:
        return

    # Nudge each model sideways a little so the error bars don't overlap.
    offsets = np.linspace(-0.1, 0.1, len(lines)) if len(lines) > 1 else [0]
    fig, axes = plt.subplots(1, len(DIMENSIONS), figsize=(16, 4.6), sharey=True)
    for ax, (column, dimension_title) in zip(axes, DIMENSIONS.items()):
        for offset, (model, points) in zip(offsets, lines.items()):
            colour, marker = model_style(models, model)
            xs = [x + offset for x, _ in points]
            means, cis = zip(*[summarise(rows[column])[:2] for _, rows in points])
            ax.errorbar(xs, means, yerr=cis, color=colour, linewidth=2,
                        marker=marker, markersize=6, elinewidth=1, capsize=2.5,
                        label=model)
        style_axis(ax, dimension_title)
        ax.set_xticks(range(len(x_labels)), x_labels)
        ax.set_xlim(-0.3, len(x_labels) - 0.7)
        ax.set_xlabel(x_label)
    axes[0].set_ylabel("Lean (50/50 = no lean)")

    add_titles(fig, title, subtitle, gap=0.075)
    fig.legend(*axes[0].get_legend_handles_labels(), loc="upper left",
               ncol=min(len(lines), 7), frameon=False,
               bbox_to_anchor=(0.005, 0.86))
    fig.tight_layout(rect=(0, 0, 1, 0.78))
    save(fig, path)


def plot_chunk_size_lines(df, models):
    """Base persona: how each model's result changes with chunk size."""
    base_rows = df[df["varied_attribute"] == "base"]
    modes = list(CHUNK_AXIS)
    plot_model_lines(
        models,
        list(CHUNK_AXIS.values()),
        lambda model, x: base_rows[(base_rows["model"] == model)
                                   & (base_rows["experiment_mode"] == modes[x])],
        "How chunk size changes each model's result (base persona)",
        "Mean with 95% confidence interval. Dashed line: 50% (no lean).",
        "Questions per API call",
        GRAPHS_DIR / "compare_models" / "chunk_size_lines.png",
    )


def plot_attribute_lines(df, mode, models, attribute, values, base_value):
    """One numeric attribute (e.g. age) as a line per model, for one mode."""
    rows = df[(df["experiment_mode"] == mode)
              & df["varied_attribute"].isin([attribute, "base"])]
    if attribute not in set(rows["varied_attribute"]):
        return
    plot_model_lines(
        models,
        [f"{v}\n(base)" if str(v) == str(base_value) else str(v) for v in values],
        lambda model, x: rows_with_value(rows[rows["model"] == model],
                                         attribute, values[x]),
        f"How {attribute} changes each model's result "
        f"({MODES[mode][0].lower()})",
        "Mean with 95% confidence interval; every other attribute held at the "
        "base persona.",
        attribute.capitalize(),
        GRAPHS_DIR / "compare_models" / mode / f"{attribute}_lines.png",
    )


# ─────────────── Summary table ───────────────

def write_summary(df):
    records = []
    group_columns = ["model", "experiment_mode", "varied_attribute",
                     "persona_age", "persona_gender", "persona_nationality",
                     "persona_occupation"]
    # dropna=False keeps the no-persona control, which has no persona values.
    for keys, group in df.groupby(group_columns, dropna=False):
        record = dict(zip(group_columns, keys))
        record["n"] = len(group)
        for column in DIMENSIONS:
            mean, ci, _ = summarise(group[column])
            letter = column[-1]
            record[f"{letter}_mean"] = round(mean, 1)
            record[f"{letter}_ci95"] = round(ci, 1)
        record["most_common_type"] = group["personality_type"].mode().iloc[0]
        if "retries" in group:
            record["retries"] = int(group["retries"].sum())
        records.append(record)
    path = GRAPHS_DIR / "summary.csv"
    pd.DataFrame(records).to_csv(path, index=False)
    print(f"Saved {path.relative_to(PROJECT_DIR)}")


def main():
    config = load_persona_config()
    models = list(load_models())
    df = load_results(config)
    # Models no longer in models.json still get charts, after the listed ones.
    models += sorted(set(df["model"]) - set(models))
    print(f"Loaded {len(df)} repetitions:")
    print(df.groupby(["model", "experiment_mode"]).size().to_string(), "\n")

    # Start clean so charts for deleted data don't linger.
    for folder in ("compare_models", "per_model"):
        shutil.rmtree(GRAPHS_DIR / folder, ignore_errors=True)
    GRAPHS_DIR.mkdir(exist_ok=True)

    rng = np.random.default_rng(0)
    plot_chunk_size_lines(df, models)
    for mode in MODES:
        plot_base_persona_by_model(df, mode, models, rng)
        plot_persona_vs_default(df, mode, models, rng)
        for attribute, values in config["variations"].items():
            plot_shift_heatmap(df, mode, models, attribute, values,
                               config["base"][attribute])
            # Lines only make sense when the values have an order.
            if all(isinstance(value, (int, float)) for value in values):
                plot_attribute_lines(df, mode, models, attribute, values,
                                     config["base"][attribute])
    for model in ordered_present(models, df["model"]):
        plot_mode_comparison(df, model, rng)
        for attribute, values in config["variations"].items():
            plot_attribute_by_mode(df, model, attribute, values,
                                   config["base"][attribute])
    write_summary(df)


if __name__ == "__main__":
    main()
