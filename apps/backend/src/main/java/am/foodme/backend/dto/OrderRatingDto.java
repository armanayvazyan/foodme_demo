package am.foodme.backend.dto;

import am.foodme.backend.model.OrderRating;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderRatingDto {
    private Integer rating;
    private String comment;
    private Instant createdAt;

    public static OrderRatingDto mapEntityToDto(OrderRating entity) {
        if (entity == null) {
            return null;
        }
        return new OrderRatingDto(entity.getRating(), entity.getComment(), entity.getCreatedAt());
    }
}
