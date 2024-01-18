.PHONY: all
all: pairs

node_modules: package.json bun.lockb
	bun install
	touch node_modules

paths.json: node_modules scripts/paths.ts svgs
	scripts/paths.ts

polygons: scripts/polygons.ts paths.json
	rm -rf polygons
	scripts/polygons.ts

target/release/text-optimization: Cargo.toml Cargo.lock src/*
	cargo build --release
	touch target/release/text-optimization

pairs: scripts/pairs.ts target/release/text-optimization polygons
	rm -rf pairs
	scripts/pairs.ts
