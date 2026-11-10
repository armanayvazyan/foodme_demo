package am.foodme.backend.repository;

import am.foodme.backend.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByNumber(String number);

    Page<Order> findByStatus(String status, Pageable pageable);

    Page<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    @Query(value = "SELECT nextval('foodme.order_number_seq')", nativeQuery = true)
    long nextOrderNumberSequenceValue();

    /**
     * Changes the status only if it is still {@code from}, so two concurrent status changes
     * (for example a customer cancel and an admin accept) cannot overwrite each other.
     *
     * @return the number of rows updated: 1 on success, 0 if the status had already changed
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Order o set o.status = :to where o.id = :id and o.status = :from")
    int updateStatusIfCurrent(@Param("id") Long id, @Param("from") String from, @Param("to") String to);
}
