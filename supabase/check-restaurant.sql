-- Check if the restaurant "Al Madina Istanbul" exists
SELECT id, name, created_at
FROM public.restaurants
WHERE name = 'Al Madina Istanbul';

-- If no results, create the restaurant:
-- INSERT INTO public.restaurants (name)
-- VALUES ('Al Madina Istanbul');
