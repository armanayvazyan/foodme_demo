package am.foodme.backend.repository;

import am.foodme.backend.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Order.rating is the inverse side of a one-to-one, which Hibernate can't load lazily: without a
 * fetch join every loaded order costs one extra SELECT on order_rating. The read methods below
 * join the rating in so lists stay at one query per page (SCRUM-4).
 */
public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = "rating")
    Optional<Order> findByNumber(String number);

    @EntityGraph(attributePaths = "rating")
    Page<Order> findByStatus(String status, Pageable pageable);

    @EntityGraph(attributePaths = "rating")
    Page<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "rating")
    Page<Order> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "rating")
    Optional<Order> findById(Long id);

    @Query(value = "SELECT nextval('foodme.order_number_seq')", nativeQuery = true)
    long nextOrderNumberSequenceValue();

    /**
     * Atomically moves an order from {@code from} to {@code to}. Returns 1 if it moved, 0 if the
     * order was no longer in {@code from} — e.g. the kitchen accepted it a moment before the
     * customer cancelled. This is what keeps simultaneous cancel/accept from both succeeding.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE foodme.\"order\" SET status = :to WHERE id = :id AND status = :from", nativeQuery = true)
    int transitionStatus(@Param("id") Long id, @Param("from") String from, @Param("to") String to);
}
