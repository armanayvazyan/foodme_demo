package am.foodme.backend.dto;

import am.foodme.backend.model.Chef;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChefResponseDto {
    private Long id;
    private String username;
    private String phoneNumber;
    private String email;
    private String avatarUrl;
    private String bannerUrl;
    private String status;
    private String nameEn;
    private String nameHy;
    private String nameRu;
    private String descriptionEn;
    private String descriptionHy;
    private String descriptionRu;
    private String kitchenEn;
    private String kitchenHy;
    private String kitchenRu;
    private Double rating;
    private Double platformFee;
    private Double deliveryPrice;
    private Double freeDeliveryFrom;
    private Integer priorityIndex;

    public static ChefResponseDto mapEntityToDto(Chef chef, Double rating) {
        if (chef == null) {
            return null;
        }
        ChefResponseDto dto = new ChefResponseDto();
        dto.setId(chef.getId());
        dto.setUsername(chef.getUsername());
        dto.setPhoneNumber(chef.getPhoneNumber());
        dto.setEmail(chef.getEmail());
        dto.setAvatarUrl(chef.getAvatarUrl());
        dto.setBannerUrl(chef.getBannerUrl());
        dto.setStatus(chef.getStatus());
        dto.setNameEn(chef.getFullNameEn());
        dto.setNameHy(chef.getFullNameAm());
        dto.setNameRu(chef.getFullNameRu());
        dto.setDescriptionEn(chef.getDescriptionEn());
        dto.setDescriptionHy(chef.getDescriptionAm());
        dto.setDescriptionRu(chef.getDescriptionRu());
        dto.setKitchenEn(chef.getKitchenEn());
        dto.setKitchenHy(chef.getKitchenAm());
        dto.setKitchenRu(chef.getKitchenRu());
        dto.setRating(rating);
        dto.setPlatformFee(chef.getPlatformFee());
        dto.setDeliveryPrice(chef.getDeliveryPrice());
        dto.setFreeDeliveryFrom(chef.getFreeDeliveryFrom());
        dto.setPriorityIndex(chef.getPriorityIndex());
        return dto;
    }
}
