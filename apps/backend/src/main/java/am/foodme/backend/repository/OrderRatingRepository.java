package am.foodme.backend.repository;

import am.foodme.backend.model.OrderRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRatingRepository extends JpaRepository<OrderRating, Long> {
    boolean existsByOrderId(Long orderId);

    Optional<OrderRating> findByOrderId(Long orderId);

    interface ChefAverage {
        Long getChefId();

        Double getAverageRating();
    }

    @Query("""
            SELECT r.chef.id AS chefId, AVG(r.rating) AS averageRating
            FROM OrderRating r
            WHERE r.chef.id IN :chefIds
            GROUP BY r.chef.id
            """)
    List<ChefAverage> findAveragesByChefIds(@Param("chefIds") Collection<Long> chefIds);

    @Query("SELECT AVG(r.rating) FROM OrderRating r WHERE r.chef.id = :chefId")
    Double findAverageByChefId(@Param("chefId") Long chefId);
}
