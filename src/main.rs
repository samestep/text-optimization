mod lbfgs;

use minkowski::{extract_loops, reduced_convolution, Point};
use rand::{Rng, SeedableRng};
use rand_pcg::Pcg64Mcg;
use std::{
    fmt,
    fs::{create_dir_all, File},
    io::Write as _,
    ops::{Add, Div, Mul, Sub},
    path::Path,
};
use svgtypes::PathParser;

#[derive(Clone, Copy, Debug, PartialEq)]
struct Vec2 {
    x: f64,
    y: f64,
}

fn vec2(x: f64, y: f64) -> Vec2 {
    Vec2 { x, y }
}

impl Add for Vec2 {
    type Output = Vec2;

    fn add(self, rhs: Vec2) -> Vec2 {
        vec2(self.x + rhs.x, self.y + rhs.y)
    }
}

impl Sub for Vec2 {
    type Output = Vec2;

    fn sub(self, rhs: Vec2) -> Vec2 {
        vec2(self.x - rhs.x, self.y - rhs.y)
    }
}

impl Mul<Vec2> for f64 {
    type Output = Vec2;

    fn mul(self, rhs: Vec2) -> Vec2 {
        vec2(self * rhs.x, self * rhs.y)
    }
}

impl Mul<f64> for Vec2 {
    type Output = Vec2;

    fn mul(self, rhs: f64) -> Vec2 {
        vec2(self.x * rhs, self.y * rhs)
    }
}

impl Div<f64> for Vec2 {
    type Output = Vec2;

    fn div(self, rhs: f64) -> Vec2 {
        vec2(self.x / rhs, self.y / rhs)
    }
}

fn dot(u: Vec2, v: Vec2) -> f64 {
    u.x * v.x + u.y * v.y
}

struct Bezier {
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
}

impl Bezier {
    fn at(&self, t: f64) -> Vec2 {
        let &Self { p0, p1, p2, p3 } = self;
        // https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
        let t2 = t * t;
        let t3 = t2 * t;
        let s = 1. - t;
        let s2 = s * s;
        let s3 = s2 * s;
        s3 * p0 + 3. * s2 * t * p1 + 3. * s * t2 * p2 + t3 * p3
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
const SCALE: f64 = 1. / 15.;

type Polygon = Vec<Vec2>;

fn polygonize(path: &str) -> Polygon {
    let mut points = vec![];
    let mut x0 = f64::NAN;
    let mut y0 = f64::NAN;
    for segment in PathParser::from(path) {
        use svgtypes::PathSegment::*;
        match segment.unwrap() {
            MoveTo { abs, x, y } => {
                assert!(abs);
                points.push(vec2(x, y));
                (x0, y0) = (x, y);
            }
            LineTo { abs, x, y } => {
                assert!(abs);
                points.push(vec2(x, y));
                (x0, y0) = (x, y);
            }
            HorizontalLineTo { abs, x } => {
                assert!(abs);
                points.push(vec2(x, y0));
                x0 = x;
            }
            VerticalLineTo { abs, y } => {
                assert!(abs);
                points.push(vec2(x0, y));
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
                    p0: vec2(x0, y0),
                    p1: vec2(x1, y1),
                    p2: vec2(x2, y2),
                    p3: vec2(x, y),
                };
                points.push(curve.at(1. / 5.));
                points.push(curve.at(2. / 5.));
                points.push(curve.at(3. / 5.));
                points.push(curve.at(4. / 5.));
                points.push(vec2(x, y));
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

// https://iquilezles.org/articles/distfunctions2d/
fn sd_polygon(v: &[Vec2], p: Vec2) -> (f64, Vec2) {
    let n = v.len();
    let u = p - v[0];
    let mut d = dot(u, u);
    let mut dp = 2. * u;
    let mut s = 1.0;
    let mut i = 0;
    let mut j = n - 1;
    while i < n {
        let e = v[j] - v[i];
        let w = p - v[i];
        let we = dot(w, e);
        let ee = dot(e, e);
        let r = we / ee;
        let rc = r.clamp(0.0, 1.0);
        let b = w - e * rc;
        let bb = dot(b, b);
        if bb < d {
            d = bb;
            let db = 2. * b;
            let drc = -dot(e, db);
            let dr = if (0.0..=1.0).contains(&r) { drc } else { 0. };
            let dwe = dr / ee;
            let dw = db + dwe * e;
            dp = dw;
        }
        let c = [p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x];
        if c.iter().all(|&a| a) || c.iter().all(|&a| !a) {
            s *= -1.0;
        }
        j = i;
        i += 1;
    }
    let z = s * d.sqrt();
    (z, dp / (2. * z))
}

struct Glyphs {
    indices: Vec<usize>,
    hues: Vec<f64>,
    coords: Vec<f64>,
}

fn init(seed: u64) -> Glyphs {
    let mut rng = Pcg64Mcg::seed_from_u64(seed);
    let n = 100;
    let mut coords: Vec<_> = (0..n).map(|_| rng.gen_range(0.0..WIDTH)).collect();
    coords.extend((0..n).map(|_| rng.gen_range(0.0..HEIGHT)));
    Glyphs {
        indices: (0..n).map(|_| rng.gen_range(0..GLYPHS.len())).collect(),
        hues: (0..n).map(|_| rng.gen_range(0.0..360.0)).collect(),
        coords,
    }
}

struct Sums {
    contains: Vec<Polygon>,
}

fn val_and_grad(sums: &Sums, indices: &[usize], coords: &[f64], grad: &mut [f64]) -> f64 {
    grad.fill(0.);
    let n = indices.len();
    let (x, y) = coords.split_at(n);
    let (dx, dy) = grad.split_at_mut(n);
    let mut fx = 0.;
    for i in 0..n {
        let (z, dp) = sd_polygon(&sums.contains[indices[i]], vec2(x[i], y[i]));
        if z > 0. {
            fx += z;
            dx[i] += dp.x;
            dy[i] += dp.y;
        }
    }
    fx
}

fn optimize(sums: &Sums, mut glyphs: Glyphs, mut callback: impl FnMut(&[usize], &[f64], &[f64])) {
    callback(&glyphs.indices, &glyphs.hues, &glyphs.coords);
    let cfg = lbfgs::Config {
        m: 17,
        armijo: 0.001,
        wolfe: 0.9,
        min_interval: 1e-9,
        max_steps: 10,
        epsd: 1e-11,
    };
    let mut state = lbfgs::first_step(
        cfg,
        |coords, grad| val_and_grad(sums, &glyphs.indices, coords, grad),
        &mut glyphs.coords,
    );
    callback(&glyphs.indices, &glyphs.hues, &glyphs.coords);
    let mut fx = f64::NAN;
    lbfgs::step_until(
        cfg,
        |coords, grad| val_and_grad(sums, &glyphs.indices, coords, grad),
        &mut glyphs.coords,
        &mut state,
        |info| {
            callback(&glyphs.indices, &glyphs.hues, info.x);
            if info.fx == fx {
                Some(())
            } else {
                println!("{}", info.fx);
                fx = info.fx;
                None
            }
        },
    );
}

fn polygon(w: &mut impl fmt::Write, points: &[Vec2]) -> fmt::Result {
    let x0 = points.iter().map(|v| v.x).reduce(f64::min).unwrap();
    let y0 = points.iter().map(|v| v.y).reduce(f64::min).unwrap();
    writeln!(
        w,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {} {}">"#,
        points.iter().map(|v| v.x).reduce(f64::max).unwrap() - x0,
        points.iter().map(|v| v.y).reduce(f64::max).unwrap() - y0,
    )?;
    let Vec2 { x, y } = points[0];
    write!(w, "  <polygon points=\"{x},{y}")?;
    for Vec2 { x, y } in &points[1..] {
        write!(w, " {x},{y}")?;
    }
    writeln!(w, "\" />")?;
    writeln!(w, "</svg>")?;
    Ok(())
}

// https://github.com/penrose/penrose/blob/7c1978f4e33498828d6893d7d8f9257d2f1f839b/packages/core/src/utils/Util.ts#L415-L450
fn hsv_to_rgb(h0: f64, s0: f64, v0: f64) -> (f64, f64, f64) {
    fn hsv2rgb(r1: f64, g1: f64, b1: f64, m: f64) -> (f64, f64, f64) {
        (255. * (r1 + m), 255. * (g1 + m), 255. * (b1 + m))
    }

    let h = (h0 % 360.) + if h0 < 0. { 360. } else { 0. };
    let s = s0 / 100.0;
    let v = v0 / 100.0;
    let c = v * s;
    let x = c * (1. - (((h / 60.) % 2.) - 1.).abs());
    let m = v - c;

    if h < 60. {
        hsv2rgb(c, x, 0., m)
    } else if h < 120. {
        hsv2rgb(x, c, 0., m)
    } else if h < 180. {
        hsv2rgb(0., c, x, m)
    } else if h < 240. {
        hsv2rgb(0., x, c, m)
    } else if h < 300. {
        hsv2rgb(x, 0., c, m)
    } else {
        hsv2rgb(c, 0., x, m)
    }
}

fn arrangement(
    w: &mut impl fmt::Write,
    indices: &[usize],
    hues: &[f64],
    coords: &[f64],
) -> fmt::Result {
    let n = hues.len();
    let &(_, big) = GLYPHS.iter().find(|&&(c, _)| c == BIG).unwrap();
    writeln!(
        w,
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}">"#,
    )?;
    writeln!(w, r##"  <path fill="#C1C1C1" d="{big}" />"##)?;
    for (i, (&j, &h)) in indices.iter().zip(hues.iter()).enumerate() {
        let (_, path) = GLYPHS[j];
        let (r, g, b) = hsv_to_rgb(h, 60., 100.);
        writeln!(
            w,
            r##"  <path paint-order="stroke" fill="rgb({r} {g} {b})" stroke="#080664" stroke-opacity="{}" stroke-width="{}" stroke-linejoin="round" transform="translate({} {}) scale({SCALE} {SCALE})" d="{}" />"##,
            0xea as f64 / 255.,
            1.5 / SCALE,
            coords[i],
            coords[n + i],
            path,
        )?;
    }
    writeln!(w, "</svg>")?;
    Ok(())
}

fn main() {
    let polygons: Vec<Polygon> = GLYPHS.iter().map(|&(_, path)| polygonize(path)).collect();

    let mut big: Vec<Point> = polygons[GLYPHS.iter().position(|&(c, _)| c == BIG).unwrap()]
        .iter()
        .map(|&Vec2 { x, y }| (x, y))
        .collect();
    big.reverse();
    let contains: Vec<Polygon> = polygons
        .iter()
        .map(|q| {
            let q1: Vec<Point> = q
                .iter()
                .map(|&Vec2 { x, y }| (SCALE * -x, SCALE * -y))
                .collect();
            extract_loops(&reduced_convolution(&big, &q1))
                .swap_remove(0)
                .into_iter()
                .map(|(x, y)| Vec2 { x, y })
                .collect()
        })
        .collect();

    let pairs: Vec<Vec<Polygon>> = polygons
        .iter()
        .map(|p| {
            let p1: Vec<Point> = p.iter().map(|&Vec2 { x, y }| (x, y)).collect();
            polygons
                .iter()
                .map(|q| {
                    let q1: Vec<Point> = q.iter().map(|&Vec2 { x, y }| (-x, -y)).collect();
                    extract_loops(&reduced_convolution(&p1, &q1))
                        .swap_remove(0)
                        .into_iter()
                        .map(|(x, y)| Vec2 { x, y })
                        .collect()
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
    let mut i = 0;
    optimize(&Sums { contains }, init(0), |indices, hues, coords| {
        let mut s = String::new();
        arrangement(&mut s, indices, hues, coords).unwrap();
        File::create(dir_frames.join(format!("{i}.svg")))
            .unwrap()
            .write_all(s.as_bytes())
            .unwrap();
        i += 1;
    });
}
