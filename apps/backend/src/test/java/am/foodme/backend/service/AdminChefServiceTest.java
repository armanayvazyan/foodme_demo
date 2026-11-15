package am.foodme.backend.service;

import am.foodme.backend.model.Chef;
import am.foodme.backend.repository.ChefRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** SCRUM-4: the chef rating is computed from customer reviews, so an admin edit must keep it. */
class AdminChefServiceTest {

    @Test
    void updateKeepsTheComputedRatingWhateverTheFormSends() {
        ChefRepository repository = mock(ChefRepository.class);
        Chef stored = new Chef();
        stored.setId(2L);
        stored.setRating(4.3);
        when(repository.findById(2L)).thenReturn(Optional.of(stored));
        when(repository.save(any(Chef.class))).thenAnswer(inv -> inv.getArgument(0));

        Chef edited = new Chef();
        edited.setUsername("chef2");
        edited.setRating(1.0);

        Chef saved = new AdminChefService(repository).update(2L, edited);

        assertEquals(4.3, saved.getRating());
        assertEquals(2L, saved.getId());
    }
}
