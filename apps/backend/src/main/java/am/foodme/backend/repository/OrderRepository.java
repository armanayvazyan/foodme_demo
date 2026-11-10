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

    Optional<Order> findByNumberAndCustomerId(String number, Long customerId);

    /**
     * Conditional (compare-and-set) status change: only updates the row while its
     * status still equals {@code expectedStatus}. Returns the number of rows changed
     * (0 means another transition already won). Must run inside a transaction.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.status = :newStatus WHERE o.id = :id AND o.status = :expectedStatus")
    int transitionStatus(@Param("id") Long id,
                         @Param("expectedStatus") String expectedStatus,
                         @Param("newStatus") String newStatus);

    /** Same as {@link #transitionStatus}, also setting the reject reason in the same statement. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.status = :newStatus, o.rejectReason = :rejectReason "
            + "WHERE o.id = :id AND o.status = :expectedStatus")
    int transitionStatusWithRejectReason(@Param("id") Long id,
                                         @Param("expectedStatus") String expectedStatus,
                                         @Param("newStatus") String newStatus,
                                         @Param("rejectReason") String rejectReason);

    Page<Order> findByStatus(String status, Pageable pageable);

    Page<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    @Query(value = "SELECT nextval('foodme.order_number_seq')", nativeQuery = true)
    long nextOrderNumberSequenceValue();
}
