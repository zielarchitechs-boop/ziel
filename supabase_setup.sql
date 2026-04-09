-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  first_name text,
  last_name text,
  middle_name text,
  phone_code text,
  phone_number text,
  institution text,
  role text,
  country text,
  email text,
  is_admin boolean default false,
  is_admin_pending boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for projects
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'On Hold', 'Awaiting Approval', 'Inactive', 'Awaiting Acceptance')),
  order_number text,
  client_name text,
  deadline timestamp with time zone,
  billing_type text,
  quote_amount decimal(12,2),
  quote_currency text,
  attachments text[],
  completed_files text[],
  specifications jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- STORAGE POLICIES (Run in SQL Editor)
-- ==========================================

-- 1. Enable storage for the bucket (if not already enabled)
insert into storage.buckets (id, name, public) 
values ('PROJECT-ATTACHMENTS', 'PROJECT-ATTACHMENTS', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if they exist to avoid conflicts
drop policy if exists "Users can view own attachments" on storage.objects;
drop policy if exists "Users can upload own attachments" on storage.objects;
drop policy if exists "Users can update own attachments" on storage.objects;
drop policy if exists "Users can delete own attachments" on storage.objects;
drop policy if exists "Admins can do everything in storage" on storage.objects;

-- 2. Policy: Allow users to view their own attachments
create policy "Users can view own attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'PROJECT-ATTACHMENTS' AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (exists (
      select 1 from profiles 
      where id = auth.uid() 
      and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
    ))
  )
);

-- 3. Policy: Allow users to upload their own attachments
create policy "Users can upload own attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'PROJECT-ATTACHMENTS' AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (exists (
      select 1 from profiles 
      where id = auth.uid() 
      and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
    ))
  )
);

-- 4. Policy: Allow users to update their own attachments
create policy "Users can update own attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'PROJECT-ATTACHMENTS' AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (exists (
      select 1 from profiles 
      where id = auth.uid() 
      and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
    ))
  )
);

-- 5. Policy: Allow users to delete their own attachments
create policy "Users can delete own attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'PROJECT-ATTACHMENTS' AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (exists (
      select 1 from profiles 
      where id = auth.uid() 
      and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
    ))
  )
);

-- 6. Add a catch-all admin policy for storage
create policy "Admins can do everything in storage"
on storage.objects for all
to authenticated
using (
  bucket_id = 'PROJECT-ATTACHMENTS' AND
  (exists (
    select 1 from profiles 
    where id = auth.uid() 
    and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
  ))
)
with check (
  bucket_id = 'PROJECT-ATTACHMENTS' AND
  (exists (
    select 1 from profiles 
    where id = auth.uid() 
    and (is_admin = true OR email = 'studyguide.me001@gmail.com' OR institution = 'Intelligent Prospect Solution (IPS)')
  ))
);

-- Create a table for invoices
create table invoices (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  amount decimal(12,2) not null,
  status text default 'Unpaid' check (status in ('Unpaid', 'Paid', 'Overdue', 'Cancelled')),
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;
alter table projects enable row level security;
alter table invoices enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));
create policy "Admins can delete any profile." on profiles for delete using (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com')));

-- Projects policies
create policy "Users can view their own projects." on projects for select using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));
create policy "Anyone can insert projects." on projects for insert with check (true);
create policy "Users can update their own projects." on projects for update using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));
create policy "Users can delete their own projects." on projects for delete using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));

-- Invoices policies
create policy "Users can view their own invoices." on invoices for select using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));
create policy "Anyone can insert invoices." on invoices for insert with check (true);
create policy "Users can update their own invoices." on invoices for update using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));
create policy "Users can delete their own invoices." on invoices for delete using (auth.uid() = user_id OR (exists (select 1 from profiles where id = auth.uid() and (is_admin = true OR email = 'studyguide.me001@gmail.com'))));

-- Trigger to create profile automatically
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role, institution, country, phone_code, phone_number, is_admin_pending)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'first_name', 
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'phone_code',
    new.raw_user_meta_data->>'phone_number',
    (new.raw_user_meta_data->>'is_admin_pending')::boolean
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
