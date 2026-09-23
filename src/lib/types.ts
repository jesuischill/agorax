export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles?: Profile;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string | null;
  text: string | null;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: Profile;
};
