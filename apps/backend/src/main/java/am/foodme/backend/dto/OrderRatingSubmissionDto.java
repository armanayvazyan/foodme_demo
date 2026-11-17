package am.foodme.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class OrderRatingSubmissionDto {
    private OrderRatingDto review;
    private Long chefId;
    private Double chefRating;
}
