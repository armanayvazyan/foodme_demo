package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
// Own in-memory DB, so the orders placed here don't shift order numbers seen by OrderControllerTest.
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:foodme-customer;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
class CustomerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String customerToken() throws Exception {
        String email = "review-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String adminToken() throws Exception {
        String response = mockMvc.perform(post("/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username", "admin", "password", "admin123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    /** Places a takeaway order with Ararat Grill (chef 2) and returns its order number. */
    private String placeOrder(String token) throws Exception {
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "chefId", 2,
                                "receiverName", "Ann",
                                "receiverPhoneNumber", "+37491234567",
                                "receiverEmail", "ann@example.com",
                                "paymentType", "CASH",
                                "deliveryMethod", "TAKEAWAY",
                                "createOrderDishes", List.of(Map.of("dishId", 3, "quantity", 1))
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private void deliver(String number) throws Exception {
        String admin = adminToken();
        String order = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long id = objectMapper.readTree(order).get("id").asLong();
        for (String next : List.of("ACCEPTED", "DELIVERED")) {
            mockMvc.perform(patch("/admin/order/" + id + "/status")
                            .header("Authorization", "Bearer " + admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("status", next))))
                    .andExpect(status().isOk());
        }
    }

    private String reviewPayload(int rating, String comment) throws Exception {
        return objectMapper.writeValueAsString(Map.of("rating", rating, "comment", comment));
    }

    @Test
    void reviewOrder_deliveredOwnOrder_savesReviewAndUpdatesChefRating() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        deliver(number);

        mockMvc.perform(post("/api/customer/orders/" + number + "/review")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewPayload(4, "Great khorovats")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.review.rating").value(4))
                .andExpect(jsonPath("$.review.comment").value("Great khorovats"));

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].review.rating").value(4));

        mockMvc.perform(get("/api/chef/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4.0));
    }

    @Test
    void reviewOrder_notDelivered_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(post("/api/customer/orders/" + number + "/review")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewPayload(5, "Too early")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void reviewOrder_withoutToken_unauthorized() throws Exception {
        mockMvc.perform(post("/api/customer/orders/FM-100001/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewPayload(5, "Anonymous")))
                .andExpect(status().isUnauthorized());
    }
}
