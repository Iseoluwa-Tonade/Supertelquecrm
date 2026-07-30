-- Re-point profiles from the duplicate orgs to the survivor
update public.profiles set organisation_id = 'f15bdc7e-32b0-4626-af75-4de7693027aa'
where organisation_id in (
  '8bc82b86-bf4a-4fd4-bff9-207f07db7b58',
  '8f20be0c-9979-46a1-a2a1-7d52b7de7899'
);

-- Delete the duplicate organisations
delete from public.organisations where id in (
  '8bc82b86-bf4a-4fd4-bff9-207f07db7b58',
  '8f20be0c-9979-46a1-a2a1-7d52b7de7899'
);
