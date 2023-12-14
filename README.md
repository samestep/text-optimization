# Text optimization

Prerequisites:

```sh
curl -fsSL https://bun.sh/install | bash
brew install cgal
```

Configure:

```sh
bun install
cmake -DCMAKE_BUILD_TYPE=Release .
pip install -r requirements.txt
```

Build and run:

```sh
./build.sh  # fast
./run.sh    # slow
./reduce.sh # fast
```
