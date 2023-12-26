#!/usr/bin/env python3

import json
from pathlib import Path

import networkx as nx

tex_dict: dict[str, str] = json.loads(Path("letters.json").read_text())
letters = tex_dict.keys()

# Create a graph
G = nx.Graph()

# Add vertices (letters)
G.add_nodes_from(letters)

# Add edges for failed operations (where there's an 'X')
for a in letters:
    for b in letters:
        # if file exists
        if not Path(f"public/pairs/{a}-{b}.dat").exists():
            G.add_edge(a, b)

# Since NetworkX doesn't have a built-in minimum vertex cover algorithm,
# and exact algorithms for this problem are computationally expensive
# for large graphs, we use an approximation algorithm.
min_vertex_cover = nx.approximation.min_weighted_vertex_cover(G)

# Letters to be removed
letters_to_remove = set(min_vertex_cover)

# Remaining letters
for letter in letters:
    if letter not in letters_to_remove:
        print(letter)
