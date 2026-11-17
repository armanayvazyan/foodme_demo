package am.foodme.backend.repository;

import am.foodme.backend.model.OrderReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderReviewRepository extends JpaRepository<OrderReview, Long> {
    boolean existsByOrderId(Long orderId);

    List<OrderReview> findByChefId(Long chefId);
}
