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

build/Makefile: CMakeLists.txt
	mkdir -p build
	cd build && cmake -DCMAKE_BUILD_TYPE=Release ..

build/minkowski_diff: build/Makefile minkowski_diff.cpp
	cd build && $(MAKE)
	touch build/minkowski_diff

pairs: scripts/pairs.ts build/minkowski_diff polygons
	rm -rf pairs
	scripts/pairs.ts
