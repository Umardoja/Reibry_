create or replace function public.match_memories(query_embedding extensions.vector(2048), match_threshold double precision default 0, match_count integer default 10)
returns table (id uuid, user_id uuid, similarity double precision)
language sql stable security invoker set search_path = public, extensions
as $$ select m.id,m.user_id,1-(m.embedding <=> query_embedding) as similarity from public.memories m where m.user_id=(select auth.uid()) and m.embedding is not null and 1-(m.embedding <=> query_embedding)>=match_threshold order by m.embedding <=> query_embedding limit least(match_count,50) $$;
grant execute on function public.match_memories(extensions.vector(2048),double precision,integer) to authenticated;
