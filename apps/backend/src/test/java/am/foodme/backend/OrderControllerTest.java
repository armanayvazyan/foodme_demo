package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private final AtomicInteger customerSeq = new AtomicInteger();

    private String customerToken() throws Exception {
        String email = "order-test-" + customerSeq.incrementAndGet() + "-" + UUID.randomUUID() + "@example.com";
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

    private String cashOrderPayload() throws Exception {
        Map<String, Object> body = Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "note", "ring twice",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 2))
        );
        return objectMapper.writeValueAsString(body);
    }

    @Order(3)
    @Test
    void createOrder_cashPayment_succeeds() throws Exception {
        String token = customerToken();
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashOrderPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.number").exists())
                .andReturn().getResponse().getContentAsString();
        String number = objectMapper.readTree(response).get("number").asText();

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.list[0].number").value(number));
    }

    @Test
    void createOrder_withoutToken_unauthorized() throws Exception {
        mockMvc.perform(post("/api/order").contentType(MediaType.APPLICATION_JSON).content(cashOrderPayload()))
                .andExpect(status().isUnauthorized());
    }

    @Order(4)
    @Test
    void createOrder_nonCashPayment_rejectedWithBadRequest() throws Exception {
        Map<String, Object> body = Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CARD",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        );
        mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only CASH payment is supported"));
    }

    // FM-FLAKE-02
    @Order(1)
    @Test
    void createOrder_firstOrderGetsNumber100001() throws Exception {
        mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashOrderPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value("FM-100001"));
    }

    // FM-FLAKE-02
    @Order(2)
    @Test
    void getOrderByNumber_firstOrderIsFm100001() throws Exception {
        mockMvc.perform(post("/api/order")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(cashOrderPayload()));

        mockMvc.perform(get("/api/order/number/FM-100001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value("FM-100001"));
    }

    // FM-FLAKE-04
    @Order(5)
    @Test
    void createOrder_createdAtFallsOnToday() throws Exception {
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashOrderPayload()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String number = objectMapper.readTree(response).get("number").asText();

        String orderResponse = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String createdAt = objectMapper.readTree(orderResponse).get("createdAt").asText();

        assertTrue(createdAt.startsWith(LocalDate.now().toString()));
    }

    private String placeOrder(String token) throws Exception {
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cashOrderPayload()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private long orderId(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private ResultActions adminSetsStatus(String number, String newStatus) throws Exception {
        return mockMvc.perform(patch("/admin/order/" + orderId(number) + "/status")
                .with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", newStatus, "rejectReason", "n/a"))));
    }

    private ResultActions cancel(String number, String token) throws Exception {
        return mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                .header("Authorization", "Bearer " + token));
    }

    @Order(6)
    @Test
    void cancelOrder_ownNewOrder_becomesCancelled() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(get("/api/order/number/" + number).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.cancellable").value(true));

        cancel(number, token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellable").value(false));

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.list[0].status").value("CANCELLED"));
    }

    @Order(7)
    @Test
    void cancelOrder_afterKitchenAccepted_refused() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        adminSetsStatus(number, "ACCEPTED").andExpect(status().isOk());

        mockMvc.perform(get("/api/order/number/" + number).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.cancellable").value(false));

        cancel(number, token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This order can no longer be cancelled"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Order(8)
    @Test
    void cancelOrder_alreadyCancelled_refused() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token).andExpect(status().isOk());

        cancel(number, token).andExpect(status().isBadRequest());
    }

    @Order(9)
    @Test
    void cancelOrder_someoneElsesOrder_notFoundAndUnchanged() throws Exception {
        String number = placeOrder(customerToken());
        String otherCustomer = customerToken();

        mockMvc.perform(get("/api/order/number/" + number).header("Authorization", "Bearer " + otherCustomer))
                .andExpect(jsonPath("$.cancellable").value(false));

        cancel(number, otherCustomer).andExpect(status().isNotFound());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Order(10)
    @Test
    void cancelOrder_withoutToken_unauthorized() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.cancellable").value(false));
    }

    @Order(11)
    @ParameterizedTest
    @ValueSource(strings = {"NEW", "ACCEPTED", "DELIVERED", "REJECTED"})
    void cancelledOrder_isFinal(String newStatus) throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token).andExpect(status().isOk());

        adminSetsStatus(number, newStatus).andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Order(12)
    @Test
    void adminCannotCancelOnCustomersBehalf() throws Exception {
        String number = placeOrder(customerToken());

        adminSetsStatus(number, "CANCELLED").andExpect(status().isBadRequest());
    }
}
