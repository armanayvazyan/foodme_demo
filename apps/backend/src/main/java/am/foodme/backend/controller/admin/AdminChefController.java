package am.foodme.backend.controller.admin;

import am.foodme.backend.dto.AdminListResponseDto;
import am.foodme.backend.dto.ChefResponseDto;
import am.foodme.backend.model.Chef;
import am.foodme.backend.service.AdminChefService;
import am.foodme.backend.service.ChefRatingService;
import am.foodme.backend.utils.ControllerUtil;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping(ControllerUtil.ADMIN_CHEF_CONTROLLER)
public class AdminChefController {

    private final AdminChefService adminChefService;
    private final ChefRatingService chefRatingService;

    public AdminChefController(AdminChefService adminChefService, ChefRatingService chefRatingService) {
        this.adminChefService = adminChefService;
        this.chefRatingService = chefRatingService;
    }

    @GetMapping
    public AdminListResponseDto<ChefResponseDto> list(@RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size,
                                                        @RequestParam(required = false) String q) {
        Page<Chef> chefPage = adminChefService.list(page, size, q);
        var averages = chefRatingService.getAverages(
                chefPage.getContent().stream().map(Chef::getId).toList());
        List<ChefResponseDto> list = chefPage.getContent().stream()
                .map(chef -> ChefResponseDto.mapEntityToDto(chef, averages.get(chef.getId())))
                .collect(Collectors.toList());
        return new AdminListResponseDto<>(list, chefPage.getTotalElements());
    }

    @GetMapping("/{id}")
    public ChefResponseDto getById(@PathVariable Long id) {
        Chef chef = adminChefService.getById(id);
        return ChefResponseDto.mapEntityToDto(chef, chefRatingService.getAverage(chef.getId()));
    }

    @PutMapping("/{id}")
    public ChefResponseDto update(@PathVariable Long id, @RequestBody Chef chef) {
        Chef updated = adminChefService.update(id, chef);
        return ChefResponseDto.mapEntityToDto(updated, chefRatingService.getAverage(updated.getId()));
    }
}
