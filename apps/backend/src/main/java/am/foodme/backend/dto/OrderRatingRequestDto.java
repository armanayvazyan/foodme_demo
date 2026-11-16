package am.foodme.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderRatingRequestDto {

    @NotNull(message = "Rating is required")
    private BigDecimal rating;

    @Size(max = 1000, message = "Comment must be at most 1000 characters")
    private String comment;
}
