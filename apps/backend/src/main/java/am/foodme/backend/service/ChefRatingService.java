package am.foodme.backend.service;

import am.foodme.backend.repository.OrderRatingRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

@Service
public class ChefRatingService {

    private final OrderRatingRepository orderRatingRepository;

    public ChefRatingService(OrderRatingRepository orderRatingRepository) {
        this.orderRatingRepository = orderRatingRepository;
    }

    public Map<Long, Double> getAverages(Collection<Long> chefIds) {
        if (chefIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Double> averages = new HashMap<>();
        for (OrderRatingRepository.ChefAverage row : orderRatingRepository.findAveragesByChefIds(chefIds)) {
            averages.put(row.getChefId(), round(row.getAverageRating()));
        }
        return averages;
    }

    public Double getAverage(Long chefId) {
        return round(orderRatingRepository.findAverageByChefId(chefId));
    }

    private Double round(Double average) {
        if (average == null) {
            return null;
        }
        return BigDecimal.valueOf(average).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
