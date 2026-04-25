import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPosts } from "../api/ghost";
import type { Post } from "../api/types";

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listPosts()
      .then((res) => {
        if (!cancelled) setPosts(res.posts);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="status">Loading…</p>;
  if (error) return <p className="status error">{error}</p>;

  return (
    <ul className="post-list">
      {posts.map((post) => (
        <li key={post.id} className="post-card">
          <Link to={`/p/${post.slug}`} className="post-card-link">
            {post.feature_image && (
              <img
                src={post.feature_image}
                alt={post.feature_image_alt ?? ""}
                loading="lazy"
                className="post-card-image"
              />
            )}
            <div className="post-card-body">
              <h2 className="post-card-title">{post.title}</h2>
              {post.custom_excerpt || post.excerpt ? (
                <p className="post-card-excerpt">
                  {post.custom_excerpt || post.excerpt}
                </p>
              ) : null}
              <div className="post-card-meta">
                {post.primary_tag && (
                  <span className="tag">{post.primary_tag.name}</span>
                )}
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString()}
                </time>
                {post.visibility !== "public" && (
                  <span className="lock" aria-label="Subscriber content">🔒</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
