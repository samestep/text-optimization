.PHONY: all
all: src/paths.json public/pairs src/safe.txt

node_modules: package.json bun.lockb
	bun install
	touch node_modules

common := scripts/common.ts letters.json

svgs: node_modules $(common) scripts/latexToSVG.ts
	rm -rf svgs
	scripts/latexToSVG.ts

src/paths.json: node_modules $(common) scripts/parseSVG.ts svgs
	scripts/parseSVG.ts

polygons.json: $(common) scripts/polygonize.ts src/paths.json
	scripts/polygonize.ts

polygons: scripts/cgalize.ts polygons.json
	rm -rf polygons
	scripts/cgalize.ts

build/Makefile: CMakeLists.txt
	mkdir -p build
	cd build && cmake -DCMAKE_BUILD_TYPE=Release ..

build/minkowski_diff: build/Makefile minkowski_diff.cpp
	cd build && $(MAKE)
	touch build/minkowski_diff

public/pairs: $(common) build/minkowski_diff polygons
	rm -rf public/pairs
	scripts/minkowskiPairs.ts

requirements: requirements.txt
	pip install -r requirements.txt
	touch requirements

src/safe.txt: requirements subset.py letters.json public/pairs
	./subset.py > src/safe.txt
