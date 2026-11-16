package am.foodme.backend;

import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.repository.OrderRepository;
import am.foodme.backend.repository.OrderRatingRepository;
import am.foodme.backend.security.JwtService;
import am.foodme.backend.service.AdminOrderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.nullValue;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderRatingRepository orderRatingRepository;

    @Autowired
    private AdminOrderService adminOrderService;

    @Autowired
    private JwtService jwtService;

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

    // FOOD-3: customer cancellation. These tests have no @Order, so they run after the
    // ordered tests above and do not change which order is FM-100001.

    private String placeOrder(String token) throws Exception {
        return placeOrder(token, cashOrderPayload());
    }

    private String placeOrder(String token, String payload) throws Exception {
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private String chefTwoOrderPayload() throws Exception {
        Map<String, Object> body = Map.of(
                "chefId", 2,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 3, "quantity", 1))
        );
        return objectMapper.writeValueAsString(body);
    }

    private String deliveredOrder(String token, String payload) throws Exception {
        String number = placeOrder(token, payload);
        Long id = orderId(number);
        adminOrderService.updateStatus(id, "ACCEPTED", null);
        adminOrderService.updateStatus(id, "DELIVERED", null);
        return number;
    }

    private String ratingPayload(Object rating, String comment) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("rating", rating);
        if (comment != null) {
            body.put("comment", comment);
        }
        return objectMapper.writeValueAsString(body);
    }

    private void submitRating(String token, String number, int rating) throws Exception {
        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(rating, null)))
                .andExpect(status().isOk());
    }

    private Long orderId(String number) {
        return orderRepository.findByNumber(number).orElseThrow().getId();
    }

    private String orderStatus(String number) {
        return orderRepository.findByNumber(number).orElseThrow().getStatus();
    }

    @Test
    void cancelOrder_ownNewOrder_becomesCancelledEverywhere() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].status").value("CANCELLED"));
    }

    @Test
    void cancelOrder_afterKitchenAccepted_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        adminOrderService.updateStatus(orderId(number), "ACCEPTED", null);

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order with status ACCEPTED"));

        assertEquals("ACCEPTED", orderStatus(number));
    }

    @Test
    void cancelOrder_alreadyCancelled_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot cancel order with status CANCELLED"));
    }

    @Test
    void cancelOrder_anotherCustomersOrder_notFoundAndUnchanged() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound());

        assertEquals("NEW", orderStatus(number));
    }

    @Test
    void getOwnOrder_ownerSeesItOthersGetNotFound() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(get("/api/customer/orders/" + number).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("NEW"));
        mockMvc.perform(get("/api/customer/orders/" + number).header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customer/orders/" + number))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cancelOrder_unknownNumber_notFound() throws Exception {
        mockMvc.perform(post("/api/customer/orders/FM-999999/cancel")
                        .header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelOrder_withoutToken_unauthorizedAndUnchanged() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel"))
                .andExpect(status().isUnauthorized());

        assertEquals("NEW", orderStatus(number));
    }

    @Test
    void adminUpdateStatus_cancelledOrder_cannotMoveToAnyStatus() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        Long id = orderId(number);

        for (String target : List.of("NEW", "ACCEPTED", "DELIVERED", "REJECTED")) {
            BadRequestException ex = assertThrows(BadRequestException.class,
                    () -> adminOrderService.updateStatus(id, target, "reason"));
            assertEquals("Cannot transition order from CANCELLED to " + target, ex.getMessage());
        }
        assertEquals("CANCELLED", orderStatus(number));
    }

    @Test
    void rateOrder_deliveredOwnOrder_persistsAndReturnsReview() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());
        String comment = "A great meal";

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(5, comment)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(5))
                .andExpect(jsonPath("$.review.comment").value(comment))
                .andExpect(jsonPath("$.review.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.chefRating").isNotEmpty());

        var saved = orderRatingRepository.findByOrderId(orderId(number)).orElseThrow();
        assertEquals(5, saved.getRating());
        assertEquals(comment, saved.getComment());
        assertNotNull(saved.getCreatedAt());

        mockMvc.perform(get("/api/customer/orders/" + number)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(5))
                .andExpect(jsonPath("$.review.comment").value(comment));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review").value(nullValue()));
    }

    @Test
    void publicTracking_doesNotExposeReviewDetails() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());
        submitRating(token, number, 5);

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review").value(nullValue()));
    }

    @Test
    void otherCustomer_cannotReadReviewFromOrderDetails() throws Exception {
        String ownerToken = customerToken();
        String number = deliveredOrder(ownerToken, cashOrderPayload());
        submitRating(ownerToken, number, 5);

        mockMvc.perform(get("/api/customer/orders/" + number)
                        .header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void rateOrder_requiresCustomerAuthentication() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(4, null)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rateOrder_nonCustomerRole_isForbidden() throws Exception {
        String customerToken = customerToken();
        String number = deliveredOrder(customerToken, cashOrderPayload());
        String adminToken = jwtService.generateToken("order-rating-admin", "ADMIN");

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(4, null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void rateOrder_otherCustomersOrder_returnsNotFound() throws Exception {
        String number = deliveredOrder(customerToken(), cashOrderPayload());

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + customerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(4, null)))
                .andExpect(status().isNotFound());

        assertTrue(orderRatingRepository.findByOrderId(orderId(number)).isEmpty());
    }

    @Test
    void rateOrder_undeliveredOrder_returnsRequiredMessage() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(4, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void rateOrder_duplicate_returnsRequiredMessage() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());
        submitRating(token, number, 4);

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(5, "Second review")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Order already reviewed."));

        assertEquals(4, orderRatingRepository.findByOrderId(orderId(number)).orElseThrow().getRating());
    }

    @Test
    void rateOrder_rejectsOutOfRangeFractionalAndLongComments() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());

        for (Object invalidRating : List.of(0, 6, new BigDecimal("2.5"))) {
            mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(ratingPayload(invalidRating, null)))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(5, "x".repeat(1001))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(null, null)))
                .andExpect(status().isBadRequest());

        assertTrue(orderRatingRepository.findByOrderId(orderId(number)).isEmpty());
    }

    @Test
    void rateOrder_acceptsLowerBoundaryAndMaximumCommentLength() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token, cashOrderPayload());
        String comment = "x".repeat(1000);

        mockMvc.perform(post("/api/customer/orders/" + number + "/rating")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ratingPayload(1, comment)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(1))
                .andExpect(jsonPath("$.review.comment").value(comment));
    }

    @Test
    void rateOrder_averagesChefRatingsAndRoundsToOneDecimal() throws Exception {
        String payload = chefTwoOrderPayload();
        for (int rating : List.of(4, 4, 4, 5)) {
            String token = customerToken();
            submitRating(token, deliveredOrder(token, payload), rating);
        }

        mockMvc.perform(get("/api/chef/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4.3));
    }
}
