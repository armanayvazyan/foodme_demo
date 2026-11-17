package am.foodme.backend.controller.api;

import am.foodme.backend.dto.ChefTagOrderWithDishTagDto;
import am.foodme.backend.dto.ExploreChefResponseDto;
import am.foodme.backend.model.Chef;
import am.foodme.backend.service.ChefService;
import am.foodme.backend.utils.ControllerUtil;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(ControllerUtil.API_CHEF_CONTROLLER)
public class ChefController {

    private final ChefService chefService;

    public ChefController(ChefService chefService) {
        this.chefService = chefService;
    }

    @GetMapping("/active")
    public Map<String, Object> getActiveChefs(@RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "12") int size) {
        ChefService.ActiveChefsResult result = chefService.getActiveChefsPage(page, size);
        List<ExploreChefResponseDto> list = chefService.toExploreDtos(result.chefs());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("exploreChefResponseDtoList", list);
        response.put("count", result.totalCount());
        return response;
    }

    @GetMapping("/{id}")
    public ExploreChefResponseDto getChefById(@PathVariable Long id) {
        Chef chef = chefService.getChefById(id);
        return chefService.toExploreDtoWithDishes(chef);
    }

    @GetMapping
    public ExploreChefResponseDto getChefByUsername(@RequestParam String username) {
        Chef chef = chefService.getChefByUsername(username);
        return chefService.toExploreDtoWithDishes(chef);
    }
}
