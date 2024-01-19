use minkowski::{extract_loops, reduced_convolution, Point};
use std::{
    fmt,
    fs::{create_dir_all, File},
    io::Write as _,
    path::Path,
};
use svgtypes::PathParser;

fn add((x1, y1): Point, (x2, y2): Point) -> Point {
    (x1 + x2, y1 + y2)
}

fn mul(c: f64, (x, y): Point) -> Point {
    (c * x, c * y)
}

struct Bezier {
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
}

impl Bezier {
    fn at(&self, t: f64) -> Point {
        let &Self { p0, p1, p2, p3 } = self;
        // https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
        let t2 = t * t;
        let t3 = t2 * t;
        let s = 1. - t;
        let s2 = s * s;
        let s3 = s2 * s;
        let mut p = mul(s3, p0);
        p = add(p, mul(3. * s2 * t, p1));
        p = add(p, mul(3. * s * t2, p2));
        p = add(p, mul(t3, p3));
        p
    }
}

const GLYPHS: [(char, &str); 7] = [
    ('A', "M0.624 191L69.44 0.599987H121.936L190.752 191H148.048L135.808 155.368H55.568L43.328 191H0.624ZM65.904 125.176H125.472L96.912 42.216H94.464L65.904 125.176Z"),
    ('G', "M89.008 195.72C31.616 195.72 0.0640001 159 0.0640001 98.616C0.0640001 36.056 34.88 0.151986 88.192 0.151986C128.176 0.151986 162.992 19.736 168.704 62.984H128.448C122.736 40.68 103.968 35.24 88.192 35.24C53.92 35.24 41.408 62.44 41.408 97.256C41.408 132.888 54.736 160.632 89.008 160.632C109.136 160.632 131.712 151.112 131.712 120.92H94.992V88.28H172.24V108.136C172.24 165.8 140.96 195.72 89.008 195.72Z"),
    ('H', "M115.472 191V112.664H40.944V191H0.144V0.599987H40.944V78.936H115.472V0.599987H156.272V191H115.472Z"),
    ('I', "M0.144 191V0.599987H40.944V191H0.144Z"),
    ('P', "M0.144 191V0.599987H77.12C127.712 0.599987 149.744 26.984 149.744 64.248C149.744 101.24 127.712 127.624 77.12 127.624H40.944V191H0.144ZM40.944 92.264H75.76C98.064 92.264 107.856 81.112 107.856 64.248C107.856 47.112 98.064 35.96 75.76 35.96H40.944V92.264Z"),
    ('R', "M111.392 191L75.216 127.624H40.944V191H0.144V0.599987H77.12C127.712 0.599987 149.744 26.984 149.744 64.248C149.744 91.448 138.048 112.664 111.664 122.184L151.648 191H111.392ZM40.944 92.264H75.76C98.064 92.264 107.856 81.112 107.856 64.248C107.856 47.112 98.064 35.96 75.76 35.96H40.944V92.264Z"),
    ('S', "M79.988 195.72C30.756 195.72 0.564 172.6 0.564 130.712H42.724C43.54 147.848 53.876 161.992 80.26 161.992C101.748 161.992 114.26 152.744 114.26 137.24C114.26 124.184 105.284 118.2 87.876 114.664L61.22 109.224C31.028 103.512 5.732 89.912 5.732 55.912C5.732 19.192 35.38 0.151986 79.172 0.151986C123.78 0.151986 152.34 19.736 152.34 58.904H110.452C110.996 41.768 97.124 33.88 78.356 33.88C56.324 33.88 48.436 44.76 48.436 55.912C48.436 64.616 53.876 73.048 71.012 76.584L95.492 81.48C140.372 90.728 157.508 108.136 157.508 136.968C157.508 178.04 123.508 195.72 79.988 195.72Z"),
];
const BIG: char = 'S';
const WIDTH: f64 = 158.;
const HEIGHT: f64 = 196.;
const SCALE: f64 = 0.05;

type Polygon = Vec<Point>;

fn polygonize(path: &str) -> Polygon {
    let mut points = vec![];
    let mut x0 = f64::NAN;
    let mut y0 = f64::NAN;
    for segment in PathParser::from(path) {
        use svgtypes::PathSegment::*;
        match segment.unwrap() {
            MoveTo { abs, x, y } => {
                assert!(abs);
                points.push((x, y));
                (x0, y0) = (x, y);
            }
            LineTo { abs, x, y } => {
                assert!(abs);
                points.push((x, y));
                (x0, y0) = (x, y);
            }
            HorizontalLineTo { abs, x } => {
                assert!(abs);
                points.push((x, y0));
                x0 = x;
            }
            VerticalLineTo { abs, y } => {
                assert!(abs);
                points.push((x0, y));
                y0 = y;
            }
            CurveTo {
                abs,
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            } => {
                assert!(abs);
                let curve = Bezier {
                    p0: (x0, y0),
                    p1: (x1, y1),
                    p2: (x2, y2),
                    p3: (x, y),
                };
                points.push(curve.at(1. / 5.));
                points.push(curve.at(2. / 5.));
                points.push(curve.at(3. / 5.));
                points.push(curve.at(4. / 5.));
                points.push((x, y));
                (x0, y0) = (x, y);
            }
            ClosePath { abs } => {
                assert!(abs);
                assert_eq!(points.first().unwrap(), points.last().unwrap());
                points.pop().unwrap();
                return points;
            }
            _ => unimplemented!(),
        }
    }
    panic!()
}

fn polygon(w: &mut impl fmt::Write, points: &[Point]) -> fmt::Result {
    let x0 = points.iter().map(|&(x, _)| x).reduce(f64::min).unwrap();
    let y0 = points.iter().map(|&(_, y)| y).reduce(f64::min).unwrap();
    writeln!(
        w,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {} {}">"#,
        points.iter().map(|&(x, _)| x).reduce(f64::max).unwrap() - x0,
        points.iter().map(|&(_, y)| y).reduce(f64::max).unwrap() - y0,
    )?;
    let (x, y) = points[0];
    write!(w, "  <polygon points=\"{x},{y}")?;
    for (x, y) in &points[1..] {
        write!(w, " {x},{y}")?;
    }
    writeln!(w, "\" />")?;
    writeln!(w, "</svg>")?;
    Ok(())
}

fn arrangement(w: &mut impl fmt::Write) -> fmt::Result {
    let &(_, big) = GLYPHS.iter().find(|&&(c, _)| c == BIG).unwrap();
    writeln!(
        w,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}">"#,
        WIDTH, HEIGHT
    )?;
    writeln!(w, r#"  <path fill="grey" d="{}" />"#, big)?;
    for (i, &(_, path)) in GLYPHS.iter().enumerate() {
        writeln!(
            w,
            r#"  <path transform="translate({} 0) scale({} {})" d="{}" />"#,
            20 * i,
            SCALE,
            SCALE,
            path,
        )?;
    }
    writeln!(w, "</svg>")?;
    Ok(())
}

fn main() {
    let polygons: Vec<Polygon> = GLYPHS.iter().map(|&(_, path)| polygonize(path)).collect();

    let mut big = polygons[GLYPHS.iter().position(|&(c, _)| c == BIG).unwrap()].clone();
    big.reverse();
    let contains: Vec<Polygon> = polygons
        .iter()
        .map(|q| {
            let mut q1 = q.clone();
            for (x, y) in &mut q1 {
                *x = SCALE * -*x;
                *y = SCALE * -*y;
            }
            extract_loops(&reduced_convolution(&big, &q1)).swap_remove(0)
        })
        .collect();

    let pairs: Vec<Vec<Polygon>> = polygons
        .iter()
        .map(|p| {
            polygons
                .iter()
                .map(|q| {
                    let mut q1 = q.clone();
                    for (x, y) in &mut q1 {
                        *x = -*x;
                        *y = -*y;
                    }
                    extract_loops(&reduced_convolution(p, &q1)).swap_remove(0)
                })
                .collect()
        })
        .collect();

    let dir = Path::new("out");

    let dir_polygons = dir.join("polygons");
    create_dir_all(&dir_polygons).unwrap();
    for (i, p) in polygons.iter().enumerate() {
        let (c, _) = GLYPHS[i];
        let mut s = String::new();
        polygon(&mut s, p).unwrap();
        File::create(dir_polygons.join(format!("{c}.svg")))
            .unwrap()
            .write_all(s.as_bytes())
            .unwrap();
    }

    let dir_contains = dir.join("contains");
    create_dir_all(&dir_contains).unwrap();
    for (i, contain) in contains.iter().enumerate() {
        let (c, _) = GLYPHS[i];
        let mut s = String::new();
        polygon(&mut s, contain).unwrap();
        File::create(dir_contains.join(format!("{BIG}c-{c}.svg")))
            .unwrap()
            .write_all(s.as_bytes())
            .unwrap();
    }

    let dir_diffs = dir.join("diffs");
    create_dir_all(&dir_diffs).unwrap();
    for (i, diffs) in pairs.iter().enumerate() {
        let (a, _) = GLYPHS[i];
        for (j, diff) in diffs.iter().enumerate() {
            let (b, _) = GLYPHS[j];
            let mut s = String::new();
            polygon(&mut s, diff).unwrap();
            File::create(dir_diffs.join(format!("{a}-{b}.svg")))
                .unwrap()
                .write_all(s.as_bytes())
                .unwrap();
        }
    }

    let dir_frames = dir.join("frames");
    create_dir_all(&dir_frames).unwrap();
    let mut s = String::new();
    arrangement(&mut s).unwrap();
    File::create(dir_frames.join("0.svg"))
        .unwrap()
        .write_all(s.as_bytes())
        .unwrap();
}
