create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text,
  text text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx
  on public.posts(created_at desc);

create index if not exists stories_expires_at_idx
  on public.stories(expires_at);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := lower(
    regexp_replace(
      coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );

  if base_username = '' then
    base_username := 'user' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (
    id,
    username,
    display_name
  )
  values (
    new.id,
    base_username || substr(new.id::text, 1, 4),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      base_username
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if current_user_id = other_user then
    raise exception 'Invalid recipient';
  end if;

  select cm1.conversation_id
    into existing_id
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = current_user_id
    and cm2.user_id = other_user
  group by cm1.conversation_id
  having count(distinct cm1.user_id) = 1
     and count(distinct cm2.user_id) = 1
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.conversations default values returning id into new_id;

  insert into public.conversation_members(conversation_id, user_id)
  values
    (new_id, current_user_id),
    (new_id, other_user);

  return new_id;
end;
$$;

grant execute on function public.create_direct_conversation(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.stories enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profile owner update" on public.profiles;
create policy "profile owner update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "posts readable" on public.posts;
create policy "posts readable"
on public.posts for select
to authenticated
using (true);

drop policy if exists "posts owner insert" on public.posts;
create policy "posts owner insert"
on public.posts for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "posts owner delete" on public.posts;
create policy "posts owner delete"
on public.posts for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "likes readable" on public.likes;
create policy "likes readable"
on public.likes for select
to authenticated
using (true);

drop policy if exists "like own insert" on public.likes;
create policy "like own insert"
on public.likes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "like own delete" on public.likes;
create policy "like own delete"
on public.likes for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "follows readable own" on public.follows;
create policy "follows readable own"
on public.follows for select
to authenticated
using (follower_id = auth.uid());

drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own"
on public.follows for insert
to authenticated
with check (follower_id = auth.uid());

drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own"
on public.follows for delete
to authenticated
using (follower_id = auth.uid());

drop policy if exists "stories readable" on public.stories;
create policy "stories readable"
on public.stories for select
to authenticated
using (expires_at > now() or user_id = auth.uid());

drop policy if exists "stories own insert" on public.stories;
create policy "stories own insert"
on public.stories for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "stories own delete" on public.stories;
create policy "stories own delete"
on public.stories for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "conversations member read" on public.conversations;
create policy "conversations member read"
on public.conversations for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "conversation members own read" on public.conversation_members;
create policy "conversation members own read"
on public.conversation_members for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "messages member read" on public.messages;
create policy "messages member read"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "messages member insert" on public.messages;
create policy "messages member insert"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read"
on storage.objects for select
using (bucket_id = 'media');

drop policy if exists "media own insert" on storage.objects;
create policy "media own insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media own update" on storage.objects;
create policy "media own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media own delete" on storage.objects;
create policy "media own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'posts',
    'likes',
    'follows',
    'stories',
    'messages'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        t
      );
    end if;
  end loop;
end $$;
