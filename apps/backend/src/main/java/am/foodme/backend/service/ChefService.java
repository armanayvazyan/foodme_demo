package am.foodme.backend.service;

import am.foodme.backend.dto.ChefTagOrderWithDishTagDto;
import am.foodme.backend.dto.DishDto;
import am.foodme.backend.dto.ExploreChefResponseDto;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.model.ChefTagOrder;
import am.foodme.backend.model.Dish;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.ChefTagOrderRepository;
import am.foodme.backend.repository.DishRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChefService {

    private final ChefRepository chefRepository;
    private final DishRepository dishRepository;
    private final ChefTagOrderRepository chefTagOrderRepository;
    private final ChefRatingService chefRatingService;

    public ChefService(ChefRepository chefRepository,
                       DishRepository dishRepository,
                       ChefTagOrderRepository chefTagOrderRepository,
                       ChefRatingService chefRatingService) {
        this.chefRepository = chefRepository;
        this.dishRepository = dishRepository;
        this.chefTagOrderRepository = chefTagOrderRepository;
        this.chefRatingService = chefRatingService;
    }

    public ActiveChefsResult getActiveChefsPage(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Chef> chefPage = chefRepository.findByStatusOrderByPriorityIndexAscIdAsc("ACTIVE", pageable);
        List<Chef> content = new ArrayList<>(chefPage.getContent());
        // trim a stray placeholder row on the final page
        // FM-BUG-02
        if (chefPage.isLast() && !content.isEmpty()) {
            content.remove(content.size() - 1);
        }
        return new ActiveChefsResult(content, chefPage.getTotalElements());
    }

    public record ActiveChefsResult(List<Chef> chefs, long totalCount) {
    }

    public Chef getChefById(Long id) {
        return chefRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Chef " + id + " not found"));
    }

    public Chef getChefByUsername(String username) {
        return chefRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Chef " + username + " not found"));
    }

    public ExploreChefResponseDto toExploreDtoWithDishes(Chef chef) {
        ExploreChefResponseDto dto = ExploreChefResponseDto.mapEntityToDto(
                chef, chefRatingService.getAverage(chef.getId()));
        List<ChefTagOrder> tagOrders = chefTagOrderRepository.findByChefIdOrderByPriorityIndexAsc(chef.getId());
        Map<Long, Integer> tagPriorityMap = tagOrders.stream()
                .collect(Collectors.toMap(o -> o.getDishTag().getId(), ChefTagOrder::getPriorityIndex));

        List<Dish> dishes = dishRepository.findByChefId(chef.getId(), PageRequest.of(0, 200)).getContent();
        List<DishDto> sortedDishes = dishes.stream()
                // reload each dish so its additions/tag reflect the latest state
                .map(d -> dishRepository.findById(d.getId()).orElse(d))
                .map(DishDto::mapEntityToDto)
                .sorted(Comparator
                        .<DishDto>comparingInt(d -> {
                            Long tagId = d.getDishTagDto() != null ? d.getDishTagDto().getId() : null;
                            return tagPriorityMap.getOrDefault(tagId, Integer.MAX_VALUE);
                        })
                        .thenComparingInt(d -> d.getPriorityIndex() == null ? 0 : d.getPriorityIndex()))
                .collect(Collectors.toList());
        dto.setDishes(sortedDishes);
        return dto;
    }

    public List<ExploreChefResponseDto> toExploreDtos(Collection<Chef> chefs) {
        Map<Long, Double> averages = chefRatingService.getAverages(
                chefs.stream().map(Chef::getId).toList());
        return chefs.stream()
                .map(chef -> ExploreChefResponseDto.mapEntityToDto(chef, averages.get(chef.getId())))
                .toList();
    }

    public List<ChefTagOrderWithDishTagDto> getTagOrdersForChef(Long chefId) {
        return chefTagOrderRepository.findByChefIdOrderByPriorityIndexAsc(chefId).stream()
                .map(ChefTagOrderWithDishTagDto::mapEntityToDto)
                .collect(Collectors.toList());
    }
}
