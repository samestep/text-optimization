use itertools::Itertools;
use minkowski::{extract_loops, reduced_convolution, Point};
use std::{env::args, fs::read_to_string};

fn parse(s: &str) -> Option<Vec<Point>> {
    let mut lines = s.lines();
    let n: usize = lines.next()?.parse().ok()?;
    let v = lines
        .map(|line| {
            let mut words = line.split_whitespace();
            let x: f64 = words.next()?.parse().ok()?;
            let y: f64 = words.next()?.parse().ok()?;
            Some((x, y))
        })
        .collect::<Option<Vec<_>>>()?;
    assert_eq!(v.len(), n);
    Some(v)
}

fn main() {
    let (a, mut b) = args()
        .skip(1)
        .map(|p| parse(&read_to_string(p).unwrap()).unwrap())
        .collect_tuple()
        .expect("please provide exactly two arguments");
    for (x, y) in &mut b {
        *x = -*x;
        *y = -*y;
    }
    let c = &extract_loops(&reduced_convolution(&a, &b))[0];
    println!("{}", c.len());
    for (x, y) in c {
        println!("{x} {y}");
    }
}
