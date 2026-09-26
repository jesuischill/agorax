"use client";

import { useEffect,useState } from "react";
import {
  Heart,
  MessageCircle,
  ImagePlus,
  Send
} from "lucide-react";

type Post = {
  id:string;
  kind:string;
  caption:string;
  media_url:string|null;
  media_type:string|null;
  username:string;
  display_name:string;
  avatar_url:string|null;
  like_count:number;
  comment_count:number;
  liked:number|boolean;
};

function avatar(
  url:string|null,
  seed:string
) {
  return (
    url ||
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`
  );
}

export default function FeedClient({
  mode="feed"
}: {
  mode?:"feed"|"reels"
}) {
  const [posts,setPosts] =
    useState<Post[]>([]);

  const [text,setText] =
    useState("");

  const [file,setFile] =
    useState<File|null>(null);

  const [loading,setLoading] =
    useState(false);

  const [comments,setComments] =
    useState<Record<string,any[]>>({});

  const [openComments,setOpenComments] =
    useState<string|null>(null);

  const [commentText,setCommentText] =
    useState("");

  async function load() {
    const response =
      await fetch(
        mode === "reels"
          ? "/api/posts?kind=reel"
          : "/api/posts?kind=post",
        {cache:"no-store"}
      );

    if (response.ok) {
      setPosts(
        await response.json()
      );
    }
  }

  useEffect(() => {
    load();

    const timer =
      setInterval(
        load,
        12000
      );

    return () =>
      clearInterval(timer);
  }, [mode]);

  async function upload() {
    if (!file) return null;

    const form =
      new FormData();

    form.append(
      "file",
      file
    );

    const response =
      await fetch(
        "/api/upload",
        {
          method:"POST",
          body:form
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error
      );
    }

    return data;
  }

  async function publish() {
    if (!text.trim() && !file) {
      return;
    }

    setLoading(true);

    try {
      const media = file
        ? await upload()
        : null;

      const response =
        await fetch(
          "/api/posts",
          {
            method:"POST",
            headers:{
              "Content-Type":
                "application/json"
            },
            body:JSON.stringify({
              kind:
                mode === "reels"
                  ? "reel"
                  : "post",
              caption:text,
              mediaUrl:
                media?.url || null,
              mediaType:
                media?.mediaType ||
                null
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error
        );
      }

      setText("");
      setFile(null);

      await load();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Erreur."
      );
    } finally {
      setLoading(false);
    }
  }

  async function like(
    postId:string
  ) {
    const response =
      await fetch(
        `/api/posts/${postId}/like`,
        {method:"POST"}
      );

    if (!response.ok) return;

    const data =
      await response.json();

    setPosts(old =>
      old.map(post =>
        post.id === postId
          ? {
              ...post,
              liked:data.liked,
              like_count:data.count
            }
          : post
      )
    );
  }

  async function toggleComments(
    postId:string
  ) {
    if (
      openComments === postId
    ) {
      setOpenComments(null);
      return;
    }

    const response =
      await fetch(
        `/api/posts/${postId}/comments`
      );

    if (response.ok) {
      const data =
        await response.json();

      setComments(old => ({
        ...old,
        [postId]:data
      }));
    }

    setOpenComments(postId);
  }

  async function sendComment(
    postId:string
  ) {
    const body =
      commentText.trim();

    if (!body) return;

    const response =
      await fetch(
        `/api/posts/${postId}/comments`,
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:JSON.stringify({
            body
          })
        }
      );

    if (!response.ok) return;

    setCommentText("");

    const commentsResponse =
      await fetch(
        `/api/posts/${postId}/comments`
      );

    if (commentsResponse.ok) {
      const data =
        await commentsResponse.json();

      setComments(old => ({
        ...old,
        [postId]:data
      }));
    }

    load();
  }

  return (
    <div
      className={
        mode === "reels"
          ? "reels"
          : "feed"
      }
    >
      <div className="top-row">
        <div>
          <h1 className="page-title">
            {mode === "reels"
              ? "Reels"
              : "Ton fil"}
          </h1>

          <p className="subtitle">
            {mode === "reels"
              ? "Vidéos courtes."
              : "Tout ton monde au même endroit."}
          </p>
        </div>
      </div>

      {mode === "feed" && (
        <section className="panel composer">
          <textarea
            className="textarea"
            placeholder="Quoi de neuf ?"
            value={text}
            onChange={e =>
              setText(
                e.target.value
              )
            }
          />

          {file && (
            <div
              className="muted"
              style={{marginTop:10}}
            >
              Média sélectionné :
              {" "}
              {file.name}
            </div>
          )}

          <div className="toolbar">
            <label className="icon-btn">
              <ImagePlus size={18}/>
              <input
                type="file"
                hidden
                accept="image/*,video/*"
                onChange={e =>
                  setFile(
                    e.target.files?.[0] ||
                    null
                  )
                }
              />
            </label>

            <button
              className="btn accent"
              onClick={publish}
              disabled={loading}
            >
              <Send size={16}/>
              {loading
                ? "Publication..."
                : "Publier"}
            </button>
          </div>
        </section>
      )}

      <div className="spacer"/>

      <div className="stack">
        {!posts.length && (
          <section className="panel center">
            <div className="muted">
              Rien à afficher pour le moment.
            </div>
          </section>
        )}

        {posts.map(post =>
          mode === "reels" ? (
            <article
              className="panel reel"
              key={post.id}
            >
              <div className="reel-video">
                {post.media_url && (
                  <video
                    src={post.media_url}
                    controls
                    playsInline
                    loop
                  />
                )}
              </div>

              <div
                className="reel-caption"
              >
                <div className="row">
                  <img
                    className="avatar"
                    src={avatar(
                      post.avatar_url,
                      post.username
                    )}
                    alt=""
                  />

                  <div>
                    <div className="user-name">
                      {post.display_name}
                    </div>

                    <div className="user-handle">
                      @{post.username}
                    </div>
                  </div>
                </div>

                {post.caption && (
                  <p className="post-caption">
                    {post.caption}
                  </p>
                )}

                <div
                  className="post-actions"
                >
                  <button
                    className={
                      `action ${
                        post.liked
                          ? "liked"
                          : ""
                      }`
                    }
                    onClick={() =>
                      like(post.id)
                    }
                  >
                    <Heart
                      size={19}
                      fill={
                        post.liked
                          ? "currentColor"
                          : "none"
                      }
                    />
                    {post.like_count}
                  </button>

                  <button
                    className="action"
                    onClick={() =>
                      toggleComments(
                        post.id
                      )
                    }
                  >
                    <MessageCircle
                      size={19}
                    />
                    {post.comment_count}
                  </button>
                </div>

                {openComments ===
                  post.id && (
                  <div className="comment-box">
                    <div className="comments">
                      {(
                        comments[
                          post.id
                        ] || []
                      ).map(comment => (
                        <div
                          className="comment"
                          key={comment.id}
                        >
                          <strong>
                            @{comment.username}
                          </strong>
                          {comment.body}
                        </div>
                      ))}
                    </div>

                    <div className="row">
                      <input
                        className="input grow"
                        placeholder="Commenter..."
                        value={
                          commentText
                        }
                        onChange={e =>
                          setCommentText(
                            e.target.value
                          )
                        }
                      />

                      <button
                        className="btn"
                        onClick={() =>
                          sendComment(
                            post.id
                          )
                        }
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ) : (
            <article
              className="panel post"
              key={post.id}
            >
              <div className="post-head">
                <img
                  className="avatar"
                  src={avatar(
                    post.avatar_url,
                    post.username
                  )}
                  alt=""
                />

                <div className="user-meta">
                  <div className="user-name">
                    {post.display_name}
                  </div>

                  <div className="user-handle">
                    @{post.username}
                  </div>
                </div>
              </div>

              {post.caption && (
                <div className="post-body">
                  <div className="post-caption">
                    {post.caption}
                  </div>
                </div>
              )}

              {post.media_url && (
                <div className="post-media">
                  {post.media_type ===
                  "video" ? (
                    <video
                      src={post.media_url}
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      alt=""
                    />
                  )}
                </div>
              )}

              <div className="post-actions">
                <button
                  className={
                    `action ${
                      post.liked
                        ? "liked"
                        : ""
                    }`
                  }
                  onClick={() =>
                    like(post.id)
                  }
                >
                  <Heart
                    size={19}
                    fill={
                      post.liked
                        ? "currentColor"
                        : "none"
                    }
                  />
                  {post.like_count}
                </button>

                <button
                  className="action"
                  onClick={() =>
                    toggleComments(
                      post.id
                    )
                  }
                >
                  <MessageCircle
                    size={19}
                  />
                  {post.comment_count}
                </button>
              </div>

              {openComments ===
                post.id && (
                <div className="comment-box">
                  <div className="comments">
                    {(
                      comments[
                        post.id
                      ] || []
                    ).map(comment => (
                      <div
                        className="comment"
                        key={comment.id}
                      >
                        <strong>
                          @{comment.username}
                        </strong>
                        {comment.body}
                      </div>
                    ))}
                  </div>

                  <div className="row">
                    <input
                      className="input grow"
                      placeholder="Ajouter un commentaire..."
                      value={
                        commentText
                      }
                      onChange={e =>
                        setCommentText(
                          e.target.value
                        )
                      }
                    />

                    <button
                      className="btn"
                      onClick={() =>
                        sendComment(
                          post.id
                        )
                      }
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        )}
      </div>
    </div>
  );
}
