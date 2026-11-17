package am.foodme.backend.dto;

import am.foodme.backend.model.Chef;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExploreChefResponseDto {
    private Long id;
    private String username;
    private String avatarUrl;
    private String bannerUrl;
    private List<NameDtoTranslation> name;
    private List<DescriptionDtoTranslation> description;
    private List<KitchenDtoTranslation> kitchen;
    private Double rating;
    private String status;
    private String phoneNumber;
    private Double deliveryPrice;
    private Double freeDeliveryFrom;
    private List<String> deliveryMethods;
    private List<DishDto> dishes;

    public static ExploreChefResponseDto mapEntityToDto(Chef chef, Double rating) {
        if (chef == null) {
            return null;
        }
        ExploreChefResponseDto dto = new ExploreChefResponseDto();
        dto.setId(chef.getId());
        dto.setUsername(chef.getUsername());
        dto.setAvatarUrl(chef.getAvatarUrl());
        dto.setBannerUrl(chef.getBannerUrl());
        dto.setName(NameDtoTranslation.mapChefToTranslations(chef));
        dto.setDescription(DescriptionDtoTranslation.mapChefToTranslations(chef));
        dto.setKitchen(KitchenDtoTranslation.mapChefToTranslations(chef));
        dto.setRating(rating);
        dto.setStatus(chef.getStatus());
        dto.setPhoneNumber(chef.getPhoneNumber());
        dto.setDeliveryPrice(chef.getDeliveryPrice());
        dto.setFreeDeliveryFrom(chef.getFreeDeliveryFrom());
        dto.setDeliveryMethods(List.of("DELIVERY", "TAKEAWAY"));
        return dto;
    }
}
