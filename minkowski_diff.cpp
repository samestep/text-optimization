#include <fstream>

#include <CGAL/minkowski_sum_2.h>

typedef CGAL::Exact_predicates_exact_constructions_kernel Kernel;
typedef Kernel::Point_2 Point_2;
typedef CGAL::Polygon_2<Kernel> Polygon_2;
typedef CGAL::Polygon_with_holes_2<Kernel> Polygon_with_holes_2;
typedef std::list<Polygon_with_holes_2> Pgn_with_holes_2_container;

int main(int argc, char *argv[]) {
  if (argc <= 2) {
    std::cerr << "Please specify two filenames" << std::endl;
    return -1;
  }
  std::ifstream file_P(argv[1]);
  if (!file_P.is_open()) {
    std::cerr << "Failed to open the first file." << std::endl;
    return -1;
  }
  Polygon_2 P;
  file_P >> P;
  file_P.close();

  std::ifstream file_Q(argv[2]);
  if (!file_Q.is_open()) {
    std::cerr << "Failed to open the second file." << std::endl;
    return -1;
  }
  Polygon_2 Q;
  file_Q >> Q;
  file_Q.close();

  // negate Q
  for (Polygon_2::Vertex_iterator it = Q.vertices_begin();
       it != Q.vertices_end(); ++it) {
    *it = Point_2(-it->x(), -it->y());
  }

  Polygon_with_holes_2 sum = CGAL::minkowski_sum_by_full_convolution_2(P, Q);
  assert(sum.number_of_holes() == 0);
  Polygon_2 R = sum.outer_boundary();
  std::cout << R.size() << std::endl;
  for (Polygon_2::Vertex_iterator it = R.vertices_begin();
       it != R.vertices_end(); ++it) {
    std::cout << *it << std::endl;
  }

  return 0;
}
