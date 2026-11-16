package am.foodme.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(
        name = "order_rating",
        schema = "foodme",
        uniqueConstraints = @UniqueConstraint(name = "uq_order_rating_order_id", columnNames = "order_id")
)
@Getter
@Setter
public class OrderRating {

    @Id
    @SequenceGenerator(name = "order_rating_id_seq", sequenceName = "foodme.order_rating_id_seq", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_rating_id_seq")
    @Column(name = "id", nullable = false)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chef_id", nullable = false)
    private Chef chef;

    @Column(name = "rating_value", nullable = false)
    private Integer rating;

    @Column(name = "comment", length = 1000)
    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
