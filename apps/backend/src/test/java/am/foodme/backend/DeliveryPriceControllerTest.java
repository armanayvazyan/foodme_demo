package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration: POST /api/order/delivery-price through security, controller, service and JPA (H2).
 * Seed (src/test/resources/data.sql): chef 1 "marta-k" — delivery 700, free delivery from 8000.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeliveryPriceControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private ResultActions deliveryPrice(Object chefId, Object subtotal, String method) throws Exception {
        return mockMvc.perform(post("/api/order/delivery-price")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "chefId", chefId, "subtotal", subtotal, "deliveryMethod", method))));
    }

    @Test
    void deliveryPrice_isPublic_andTakeawayIsFree() throws Exception {
        deliveryPrice(1, 500, "TAKEAWAY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryPrice").value(0.0))
                .andExpect(jsonPath("$.freeDeliveryFrom").value(8000.0));
    }

    @Test
    void deliveryPrice_belowThreshold_chargesChefPrice() throws Exception {
        deliveryPrice(1, 3000, "DELIVERY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryPrice").value(700.0));
    }

    @Test
    void deliveryPrice_aboveThreshold_isFree() throws Exception {
        deliveryPrice(1, 9000, "DELIVERY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryPrice").value(0.0));
    }

    @Test
    void deliveryPrice_unknownChef_returns404WithErrorBody() throws Exception {
        deliveryPrice(999, 3000, "DELIVERY")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Chef 999 not found"))
                .andExpect(jsonPath("$.path").value("/api/order/delivery-price"));
    }
}
