package am.foodme.backend;

import am.foodme.backend.repository.OrderRatingRepository;
import am.foodme.backend.service.ChefRatingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChefRatingServiceTest {

    @Mock
    private OrderRatingRepository orderRatingRepository;

    private ChefRatingService chefRatingService;

    @BeforeEach
    void setUp() {
        chefRatingService = new ChefRatingService(orderRatingRepository);
    }

    @Test
    void getAverage_roundsHalfUpToOneDecimal() {
        when(orderRatingRepository.findAverageByChefId(1L)).thenReturn(4.25);

        assertEquals(4.3, chefRatingService.getAverage(1L));
    }

    @Test
    void getAverage_withoutReviewsReturnsNull() {
        when(orderRatingRepository.findAverageByChefId(1L)).thenReturn(null);

        assertNull(chefRatingService.getAverage(1L));
    }
}
