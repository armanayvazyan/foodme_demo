package am.foodme.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TEST-8: customers can cancel their own order while it is still NEW.
 *
 * Runs against its own in-memory database. The shared test DB (jdbc:h2:mem:foodme, DB_CLOSE_DELAY=-1)
 * outlives Spring contexts, so orders placed here would advance its order_number_seq and break
 * OrderControllerTest's "first order is FM-100001" checks (FM-FLAKE-02), whatever the class order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties =
        "spring.datasource.url=jdbc:h2:mem:foodme-cancel-test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CustomerOrderCancelControllerTest {

    private static final String NOT_CANCELLABLE = "Only orders that haven't been accepted can be cancelled";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ---- helpers (setup only; every test asserts its own outcome) ----

    private String customerToken() throws Exception {
        String email = "cancel-test-" + UUID.randomUUID() + "@example.com";
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

    /** Places a cash takeaway order and returns the customer's view of it (has number and id). */
    private JsonNode placeOrder(String token) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        ));
        mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
        return firstOrder(token);
    }

    /** The customer's most recent order, as returned by GET /api/customer/orders. */
    private JsonNode firstOrder(String token) throws Exception {
        String list = mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(list).get("list").get(0);
    }

    private RequestBuilder cancelRequest(String token, String number) {
        return post("/api/customer/orders/" + number + "/cancel").header("Authorization", "Bearer " + token);
    }

    private RequestBuilder adminStatusRequest(String adminToken, long orderId, String newStatus) throws Exception {
        return patch("/admin/order/" + orderId + "/status")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", newStatus, "rejectReason", "out of stock")));
    }

    // ---- tests ----

    @Test
    void cancel_newOrder_returnsCancelled() throws Exception {
        String token = customerToken();
        String number = placeOrder(token).get("number").asText();

        mockMvc.perform(cancelRequest(token, number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        JsonNode stored = firstOrder(token);
        assertEquals(number, stored.get("number").asText());
        assertEquals("CANCELLED", stored.get("status").asText());
    }

    @Test
    void cancel_acceptedOrder_rejected400_statusUnchanged() throws Exception {
        String token = customerToken();
        JsonNode order = placeOrder(token);
        mockMvc.perform(adminStatusRequest(adminToken(), order.get("id").asLong(), "ACCEPTED"))
                .andExpect(status().isOk());

        mockMvc.perform(cancelRequest(token, order.get("number").asText()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_CANCELLABLE));

        assertEquals("ACCEPTED", firstOrder(token).get("status").asText());
    }

    @Test
    void cancel_alreadyCancelled_rejected400() throws Exception {
        String token = customerToken();
        String number = placeOrder(token).get("number").asText();
        mockMvc.perform(cancelRequest(token, number))
                .andExpect(status().isOk());

        mockMvc.perform(cancelRequest(token, number))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_CANCELLABLE));

        assertEquals("CANCELLED", firstOrder(token).get("status").asText());
    }

    @Test
    void cancel_otherCustomersOrder_returns404_statusUnchanged() throws Exception {
        String ownerToken = customerToken();
        String number = placeOrder(ownerToken).get("number").asText();

        mockMvc.perform(cancelRequest(customerToken(), number))
                .andExpect(status().isNotFound());

        assertEquals("NEW", firstOrder(ownerToken).get("status").asText());
    }

    @Test
    void cancel_unknownOrder_returns404() throws Exception {
        int httpStatus = mockMvc.perform(cancelRequest(customerToken(), "FM-999999"))
                .andReturn().getResponse().getStatus();

        assertEquals(404, httpStatus);
    }

    @Test
    void cancel_withoutToken_returns401() throws Exception {
        String token = customerToken();
        String number = placeOrder(token).get("number").asText();

        int httpStatus = mockMvc.perform(post("/api/customer/orders/" + number + "/cancel"))
                .andReturn().getResponse().getStatus();

        assertEquals(401, httpStatus);
        assertEquals("NEW", firstOrder(token).get("status").asText());
    }

    @Test
    void adminCannotTransitionCancelledOrder() throws Exception {
        String token = customerToken();
        JsonNode order = placeOrder(token);
        mockMvc.perform(cancelRequest(token, order.get("number").asText()))
                .andExpect(status().isOk());
        long id = order.get("id").asLong();
        String admin = adminToken();

        for (String target : List.of("ACCEPTED", "DELIVERED", "REJECTED")) {
            int httpStatus = mockMvc.perform(adminStatusRequest(admin, id, target))
                    .andReturn().getResponse().getStatus();
            assertEquals(400, httpStatus, "admin moved a CANCELLED order to " + target);
        }

        assertEquals("CANCELLED", firstOrder(token).get("status").asText());
    }

    @Test
    void adminReject_stillStoresReason() throws Exception {
        String token = customerToken();
        long id = placeOrder(token).get("id").asLong();

        mockMvc.perform(adminStatusRequest(adminToken(), id, "REJECTED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("out of stock"));

        assertEquals("REJECTED", firstOrder(token).get("status").asText());
    }
}
